use quick_xml::Reader;
use quick_xml::events::Event;
use reqwest::{Method, StatusCode};

#[derive(Debug)]
pub enum CalDavError {
    /// Transport-level failure (DNS, TLS, connection refused, timeout, ...).
    Transport(String),
    /// Server responded with a non-2xx status.
    Status { status: u16, body: String },
}

impl std::fmt::Display for CalDavError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalDavError::Transport(e) => write!(f, "connection failed: {e}"),
            CalDavError::Status { status, body } => {
                let snippet: String = body.chars().take(300).collect();
                write!(f, "server returned HTTP {status}: {snippet}")
            }
        }
    }
}

/// One `<response>` entry from a WebDAV/CalDAV multistatus body, flattened
/// to the handful of properties this app ever asks for. Namespace prefixes
/// (`D:`, `C:`, `cal:`, unprefixed default namespace, ...) vary by server,
/// so parsing matches on local (unprefixed) element names only.
#[derive(Debug, Default, Clone)]
pub struct DavResponse {
    pub href: String,
    pub displayname: Option<String>,
    pub is_calendar_collection: bool,
    pub supported_components: Vec<String>,
    pub etag: Option<String>,
    pub calendar_data: Option<String>,
}

fn local_name(qname: &[u8]) -> String {
    let s = String::from_utf8_lossy(qname);
    match s.rfind(':') {
        Some(i) => s[i + 1..].to_string(),
        None => s.to_string(),
    }
}

/// Parses a WebDAV/CalDAV `<multistatus>` body into one [`DavResponse`] per
/// `<response>` element. Deliberately not a full generic XML-to-struct
/// mapper -- this app only ever reads a fixed, small set of properties
/// (href, displayname, resourcetype, supported-calendar-component-set,
/// getetag, calendar-data), so a single pass tracking those by local name is
/// simpler and more robust to namespace-prefix differences across servers
/// than a schema-aware parser would be.
pub fn parse_multistatus(xml: &str) -> Vec<DavResponse> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut responses = Vec::new();
    let mut stack: Vec<String> = Vec::new();
    let mut current: Option<DavResponse> = None;
    let mut response_depth: Option<usize> = None;
    let mut text_buf = String::new();

    let mark_calendar_collection = |current: &mut Option<DavResponse>| {
        if let Some(cur) = current.as_mut() {
            cur.is_calendar_collection = true;
        }
    };
    let record_comp = |current: &mut Option<DavResponse>, reader: &Reader<&[u8]>, e: &quick_xml::events::BytesStart| {
        if let Some(cur) = current.as_mut() {
            if let Some(Ok(attr)) = e
                .attributes()
                .flatten()
                .find(|a| local_name(a.key.as_ref()) == "name")
                .map(|a| a.decode_and_unescape_value(reader.decoder()).map(|v| v.to_string()))
            {
                cur.supported_components.push(attr);
            }
        }
    };

    loop {
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Err(_) => break,
            Ok(Event::Start(e)) => {
                let name = local_name(e.name().as_ref());
                if name == "response" {
                    current = Some(DavResponse::default());
                    response_depth = Some(stack.len() + 1);
                }
                if name == "calendar" {
                    mark_calendar_collection(&mut current);
                }
                if name == "comp" {
                    record_comp(&mut current, &reader, &e);
                }
                stack.push(name);
                text_buf.clear();
            }
            Ok(Event::Empty(e)) => {
                let name = local_name(e.name().as_ref());
                if name == "calendar" {
                    mark_calendar_collection(&mut current);
                }
                if name == "comp" {
                    record_comp(&mut current, &reader, &e);
                }
            }
            Ok(Event::Text(t)) => {
                text_buf.push_str(&t.decode().map(|c| c.into_owned()).unwrap_or_default());
            }
            Ok(Event::CData(t)) => {
                text_buf.push_str(&String::from_utf8_lossy(&t.into_inner()));
            }
            Ok(Event::End(e)) => {
                let name = local_name(e.name().as_ref());
                let text = std::mem::take(&mut text_buf).trim().to_string();
                if let (Some(cur), Some(rdepth)) = (current.as_mut(), response_depth) {
                    // Only the href directly under <response> identifies the
                    // resource -- nested hrefs (e.g. inside
                    // current-user-principal/href) must not overwrite it.
                    if name == "href" && stack.len() == rdepth + 1 && cur.href.is_empty() {
                        cur.href = text.clone();
                    }
                    if name == "displayname" && !text.is_empty() {
                        cur.displayname = Some(text.clone());
                    }
                    if name == "getetag" && !text.is_empty() {
                        cur.etag = Some(text.clone());
                    }
                    if name == "calendar-data" && !text.is_empty() {
                        cur.calendar_data = Some(text.clone());
                    }
                }
                if name == "response" {
                    if let Some(cur) = current.take() {
                        responses.push(cur);
                    }
                    response_depth = None;
                }
                stack.pop();
            }
            _ => {}
        }
    }
    responses
}

/// Extracts the first bare `<href>` in a body that isn't wrapped in a
/// `<response>` -- the shape `current-user-principal` and
/// `calendar-home-set` PROPFIND replies use for their single result.
fn first_href_for(xml: &str, container_local_name: &str) -> Option<String> {
    let responses = parse_multistatus(xml);
    // current-user-principal / calendar-home-set are themselves properties
    // inside a <response>, so scan raw events for the container tag instead
    // of relying on the multistatus response parser.
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut in_container = false;
    let mut in_href = false;
    let mut text_buf = String::new();
    loop {
        match reader.read_event() {
            Ok(Event::Eof) | Err(_) => break,
            Ok(Event::Start(e)) => {
                let name = local_name(e.name().as_ref());
                if name == container_local_name {
                    in_container = true;
                } else if in_container && name == "href" {
                    in_href = true;
                    text_buf.clear();
                }
            }
            Ok(Event::Text(t)) if in_href => {
                text_buf.push_str(&t.decode().map(|c| c.into_owned()).unwrap_or_default());
            }
            Ok(Event::End(e)) => {
                let name = local_name(e.name().as_ref());
                if in_href && name == "href" {
                    let href = text_buf.trim().to_string();
                    if !href.is_empty() {
                        return Some(href);
                    }
                    in_href = false;
                }
                if name == container_local_name {
                    in_container = false;
                }
            }
            _ => {}
        }
    }
    let _ = responses;
    None
}

#[derive(Clone)]
pub struct CalDavClient {
    http: reqwest::Client,
    server_url: String,
    username: String,
    password: String,
}

impl CalDavClient {
    pub fn new(server_url: impl Into<String>, username: impl Into<String>, password: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            server_url: server_url.into(),
            username: username.into(),
            password: password.into(),
        }
    }

    /// Resolves a (possibly relative) href from a DAV response against this
    /// client's server URL.
    pub fn resolve(&self, href: &str) -> String {
        if href.starts_with("http://") || href.starts_with("https://") {
            return href.to_string();
        }
        match reqwest::Url::parse(&self.server_url).and_then(|base| base.join(href)) {
            Ok(u) => u.to_string(),
            Err(_) => href.to_string(),
        }
    }

    async fn request(
        &self,
        method: Method,
        url: &str,
        depth: Option<&str>,
        extra_headers: &[(&str, &str)],
        body: Option<String>,
    ) -> Result<(StatusCode, reqwest::header::HeaderMap, String), CalDavError> {
        let mut req = self
            .http
            .request(method, url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Content-Type", "application/xml; charset=utf-8");
        if let Some(d) = depth {
            req = req.header("Depth", d);
        }
        for (k, v) in extra_headers {
            req = req.header(*k, *v);
        }
        if let Some(b) = body {
            req = req.body(b);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| CalDavError::Transport(e.to_string()))?;
        let status = resp.status();
        let headers = resp.headers().clone();
        let text = resp
            .text()
            .await
            .map_err(|e| CalDavError::Transport(e.to_string()))?;
        Ok((status, headers, text))
    }

    /// `current-user-principal` PROPFIND against `server_url`, then
    /// `calendar-home-set` PROPFIND against the principal -- the standard
    /// two-hop CalDAV discovery chain (RFC 4918 / RFC 4791).
    pub async fn discover_calendar_home(&self) -> Result<String, CalDavError> {
        let principal_body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>"#;
        let (status, _headers, text) = self
            .request(
                Method::from_bytes(b"PROPFIND").unwrap(),
                &self.server_url,
                Some("0"),
                &[],
                Some(principal_body.to_string()),
            )
            .await?;
        if !status.is_success() && status.as_u16() != 207 {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        let principal_href = first_href_for(&text, "current-user-principal")
            .ok_or_else(|| CalDavError::Status { status: 0, body: "no current-user-principal in response".into() })?;
        let principal_url = self.resolve(&principal_href);

        let home_set_body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>"#;
        let (status, _headers, text) = self
            .request(
                Method::from_bytes(b"PROPFIND").unwrap(),
                &principal_url,
                Some("0"),
                &[],
                Some(home_set_body.to_string()),
            )
            .await?;
        if !status.is_success() && status.as_u16() != 207 {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        let home_href = first_href_for(&text, "calendar-home-set")
            .ok_or_else(|| CalDavError::Status { status: 0, body: "no calendar-home-set in response".into() })?;
        Ok(self.resolve(&home_href))
    }

    /// Lists calendar collections under `calendar_home_url`, keeping only
    /// those advertising `VTODO` support (Reminders lists) -- v1 syncs
    /// checkbox tasks only, see the CalDAV sync plan.
    pub async fn list_task_calendars(&self, calendar_home_url: &str) -> Result<Vec<DavResponse>, CalDavError> {
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>"#;
        let (status, _headers, text) = self
            .request(
                Method::from_bytes(b"PROPFIND").unwrap(),
                calendar_home_url,
                Some("1"),
                &[],
                Some(body.to_string()),
            )
            .await?;
        if !status.is_success() && status.as_u16() != 207 {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        let all = parse_multistatus(&text);
        Ok(all
            .into_iter()
            .filter(|r| {
                r.is_calendar_collection
                    && r.supported_components.iter().any(|c| c.eq_ignore_ascii_case("VTODO"))
            })
            .collect())
    }

    /// `calendar-query` REPORT listing every `VTODO` resource in a
    /// calendar. Simpler and more broadly compatible than the RFC 6578
    /// `sync-collection` incremental report; see the CalDAV sync plan for
    /// why v1 starts with the full listing and treats incremental sync as a
    /// later optimization.
    pub async fn list_vtodos(&self, calendar_url: &str) -> Result<Vec<DavResponse>, CalDavError> {
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"#;
        let (status, _headers, text) = self
            .request(
                Method::from_bytes(b"REPORT").unwrap(),
                calendar_url,
                Some("1"),
                &[],
                Some(body.to_string()),
            )
            .await?;
        if !status.is_success() && status.as_u16() != 207 {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        Ok(parse_multistatus(&text))
    }

    /// Creates or updates the VTODO resource at `url`. Pass `if_match_etag`
    /// to require the update apply only against that exact server-side
    /// version (concurrency guard); pass `None` to require the resource not
    /// already exist (create). Returns the new ETag if the server sent one.
    pub async fn put_ics(
        &self,
        url: &str,
        ics: &str,
        if_match_etag: Option<&str>,
    ) -> Result<Option<String>, CalDavError> {
        let headers: Vec<(&str, &str)> = match if_match_etag {
            Some(etag) => vec![("If-Match", etag)],
            None => vec![("If-None-Match", "*")],
        };
        let mut req_headers = headers;
        req_headers.push(("Content-Type", "text/calendar; charset=utf-8"));
        let (status, headers, text) = self
            .request(Method::PUT, url, None, &req_headers, Some(ics.to_string()))
            .await?;
        if !status.is_success() {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        Ok(headers
            .get("ETag")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string()))
    }

    pub async fn delete(&self, url: &str) -> Result<(), CalDavError> {
        let (status, _headers, text) = self.request(Method::DELETE, url, None, &[], None).await?;
        // A 404 here means it's already gone server-side -- not an error for
        // our purposes, since the caller's goal ("this resource shouldn't
        // exist") is already satisfied.
        if !status.is_success() && status != StatusCode::NOT_FOUND {
            return Err(CalDavError::Status {
                status: status.as_u16(),
                body: text,
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRINCIPAL_RESPONSE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/1234567/principal/</href>
    <propstat>
      <prop>
        <current-user-principal>
          <href>/1234567/principal/</href>
        </current-user-principal>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#;

    const HOME_SET_RESPONSE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/1234567/principal/</href>
    <propstat>
      <prop>
        <C:calendar-home-set>
          <href>/1234567/calendars/</href>
        </C:calendar-home-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#;

    const CALENDAR_LIST_RESPONSE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/1234567/calendars/</href>
    <propstat>
      <prop>
        <resourcetype><collection/></resourcetype>
        <displayname/>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/1234567/calendars/home/</href>
    <propstat>
      <prop>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <displayname>Reminders</displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VTODO"/>
        </C:supported-calendar-component-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>/1234567/calendars/events/</href>
    <propstat>
      <prop>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <displayname>Calendar</displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
        </C:supported-calendar-component-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>"#;

    const VTODO_REPORT_RESPONSE: &str = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<multistatus xmlns=\"DAV:\" xmlns:C=\"urn:ietf:params:xml:ns:caldav\">\n  <response>\n    <href>/1234567/calendars/home/task1.ics</href>\n    <propstat>\n      <prop>\n        <getetag>\"abc123\"</getetag>\n        <C:calendar-data>BEGIN:VCALENDAR\\r\\nBEGIN:VTODO\\r\\nUID:task1\\r\\nSUMMARY:Buy milk\\r\\nEND:VTODO\\r\\nEND:VCALENDAR\\r\\n</C:calendar-data>\n      </prop>\n      <status>HTTP/1.1 200 OK</status>\n    </propstat>\n  </response>\n</multistatus>";

    #[test]
    fn extracts_current_user_principal_href() {
        assert_eq!(
            first_href_for(PRINCIPAL_RESPONSE, "current-user-principal"),
            Some("/1234567/principal/".to_string())
        );
    }

    #[test]
    fn extracts_calendar_home_set_href_with_namespaced_tag() {
        assert_eq!(
            first_href_for(HOME_SET_RESPONSE, "calendar-home-set"),
            Some("/1234567/calendars/".to_string())
        );
    }

    #[test]
    fn parses_calendar_list_and_filters_by_vtodo_support() {
        let all = parse_multistatus(CALENDAR_LIST_RESPONSE);
        assert_eq!(all.len(), 3);
        let vtodo_calendars: Vec<_> = all
            .iter()
            .filter(|r| {
                r.is_calendar_collection
                    && r.supported_components.iter().any(|c| c == "VTODO")
            })
            .collect();
        assert_eq!(vtodo_calendars.len(), 1);
        assert_eq!(vtodo_calendars[0].href, "/1234567/calendars/home/");
        assert_eq!(vtodo_calendars[0].displayname.as_deref(), Some("Reminders"));
    }

    #[test]
    fn does_not_mistake_root_collection_for_a_calendar() {
        let all = parse_multistatus(CALENDAR_LIST_RESPONSE);
        let root = all.iter().find(|r| r.href == "/1234567/calendars/").unwrap();
        assert!(!root.is_calendar_collection);
    }

    #[test]
    fn parses_vtodo_report_etag_and_data() {
        let all = parse_multistatus(VTODO_REPORT_RESPONSE);
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].href, "/1234567/calendars/home/task1.ics");
        assert_eq!(all[0].etag.as_deref(), Some("\"abc123\""));
        assert!(all[0].calendar_data.as_deref().unwrap().contains("Buy milk"));
    }

    #[test]
    fn resolves_relative_href_against_server_url() {
        let client = CalDavClient::new("https://p36-caldav.icloud.com", "u", "p");
        assert_eq!(
            client.resolve("/1234567/calendars/home/"),
            "https://p36-caldav.icloud.com/1234567/calendars/home/"
        );
        assert_eq!(
            client.resolve("https://other.example.com/x"),
            "https://other.example.com/x"
        );
    }

    // --- Mock-HTTP-server tests: exercise the async request/response wiring
    // itself (headers, status handling, discovery chaining), not just the
    // XML parsing already covered above. No real network I/O.

    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn discovers_calendar_home_via_two_hop_propfind() {
        let server = MockServer::start().await;
        let principal_xml = PRINCIPAL_RESPONSE.to_string();
        Mock::given(method("PROPFIND"))
            .and(path("/"))
            .and(header("Depth", "0"))
            .respond_with(ResponseTemplate::new(207).set_body_string(principal_xml))
            .mount(&server)
            .await;
        let home_xml = HOME_SET_RESPONSE.to_string();
        Mock::given(method("PROPFIND"))
            .and(path("/1234567/principal/"))
            .respond_with(ResponseTemplate::new(207).set_body_string(home_xml))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let home = client.discover_calendar_home().await.unwrap();
        assert_eq!(home, format!("{}/1234567/calendars/", server.uri()));
    }

    #[tokio::test]
    async fn list_task_calendars_filters_to_vtodo_capable_collections() {
        let server = MockServer::start().await;
        Mock::given(method("PROPFIND"))
            .and(path("/1234567/calendars/"))
            .and(header("Depth", "1"))
            .respond_with(ResponseTemplate::new(207).set_body_string(CALENDAR_LIST_RESPONSE))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let home_url = format!("{}/1234567/calendars/", server.uri());
        let calendars = client.list_task_calendars(&home_url).await.unwrap();
        assert_eq!(calendars.len(), 1);
        assert_eq!(calendars[0].displayname.as_deref(), Some("Reminders"));
    }

    #[tokio::test]
    async fn list_vtodos_reports_calendar_query() {
        let server = MockServer::start().await;
        Mock::given(method("REPORT"))
            .and(path("/1234567/calendars/home/"))
            .respond_with(ResponseTemplate::new(207).set_body_string(VTODO_REPORT_RESPONSE))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let calendar_url = format!("{}/1234567/calendars/home/", server.uri());
        let todos = client.list_vtodos(&calendar_url).await.unwrap();
        assert_eq!(todos.len(), 1);
        assert!(todos[0].calendar_data.as_deref().unwrap().contains("Buy milk"));
    }

    #[tokio::test]
    async fn put_ics_sends_if_none_match_star_when_creating() {
        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path("/1234567/calendars/home/new-task.ics"))
            .and(header("If-None-Match", "*"))
            .respond_with(ResponseTemplate::new(201).insert_header("ETag", "\"etag-1\""))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let url = format!("{}/1234567/calendars/home/new-task.ics", server.uri());
        let etag = client.put_ics(&url, "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", None).await.unwrap();
        assert_eq!(etag.as_deref(), Some("\"etag-1\""));
    }

    #[tokio::test]
    async fn put_ics_sends_if_match_when_updating() {
        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path("/1234567/calendars/home/task1.ics"))
            .and(header("If-Match", "\"abc123\""))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let url = format!("{}/1234567/calendars/home/task1.ics", server.uri());
        let result = client
            .put_ics(&url, "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", Some("\"abc123\""))
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn put_ics_surfaces_server_error_status() {
        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path("/x.ics"))
            .respond_with(ResponseTemplate::new(412).set_body_string("Precondition Failed"))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let url = format!("{}/x.ics", server.uri());
        let err = client
            .put_ics(&url, "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", Some("\"stale\""))
            .await
            .unwrap_err();
        match err {
            CalDavError::Status { status, .. } => assert_eq!(status, 412),
            other => panic!("expected Status error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn delete_treats_404_as_success() {
        let server = MockServer::start().await;
        Mock::given(method("DELETE"))
            .and(path("/already-gone.ics"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let url = format!("{}/already-gone.ics", server.uri());
        assert!(client.delete(&url).await.is_ok());
    }

    #[tokio::test]
    async fn delete_succeeds_on_204() {
        let server = MockServer::start().await;
        Mock::given(method("DELETE"))
            .and(path("/task1.ics"))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let client = CalDavClient::new(server.uri(), "user", "pass");
        let url = format!("{}/task1.ics", server.uri());
        assert!(client.delete(&url).await.is_ok());
    }
}
