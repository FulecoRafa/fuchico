import type { MessageKey } from "./en";

/** Brazilian Portuguese catalog. Typed as `Record<MessageKey, string>` so the
 * compiler rejects a missing or extra key relative to the English catalog. */
export const ptBR: Record<MessageKey, string> = {
  // Common
  "common.loading": "Carregando…",
  "common.scanning": "Escaneando…",
  "common.close": "Fechar",
  "common.open": "Abrir",
  "common.default": "Padrão",
  "common.preview": "Pré-visualização",
  "common.apply": "Aplicar",
  "common.applied": "Aplicado",
  "common.rename": "Renomear",
  "common.delete": "Excluir",
  "common.copyPath": "Copiar caminho",
  "common.revealInFileManager": "Mostrar no gerenciador de arquivos",
  "common.openFolder": "Abrir pasta",

  // Pluralized building blocks
  "count.fileOne": "{n} arquivo",
  "count.fileMany": "{n} arquivos",
  "count.occurrenceOne": "{n} ocorrência",
  "count.occurrenceMany": "{n} ocorrências",

  // App shell / activity bar
  "app.files": "Arquivos",
  "app.tasksCalendar": "Tarefas e calendário",
  "app.search": "Busca",
  "app.tags": "Tags",
  "app.settings": "Configurações",
  "app.noFileOpen": "Nenhum arquivo aberto",
  "app.diagram": "Diagrama",

  // Tabs
  "tabs.close": "Fechar",
  "tabs.closeOthers": "Fechar outras",
  "tabs.closeAll": "Fechar todas",
  "tabs.openInNewWindow": "Abrir em nova janela",

  // File explorer
  "explorer.noFolderOpen": "Nenhuma pasta aberta",
  "explorer.newFile": "Novo arquivo",
  "explorer.newFolder": "Nova pasta",
  "explorer.newDrawing": "Novo desenho",
  "explorer.openFolderAction": "Abrir pasta…",
  "explorer.refresh": "Atualizar",
  "explorer.cut": "Recortar",
  "explorer.cutItems": "Recortar {count} itens",
  "explorer.pasteHere": "Colar {name} aqui",
  "explorer.openWithDefault": "Abrir com o app padrão",
  "explorer.openWith": "Abrir com {tool}",
  "explorer.copyPaths": "Copiar {count} caminhos",
  "explorer.deleteItems": "Excluir {count} itens",
  "explorer.confirmDelete": "Excluir {name}?",
  "explorer.itemsCount": "{count} itens",
  "explorer.importFailed": "Falha na importação: {errors}",
  "explorer.importedOne": "1 arquivo importado para {folder}",
  "explorer.importedMany": "{count} arquivos importados para {folder}",

  // Command palette / quick switcher
  "palette.runCommand": "Executar um comando…",
  "palette.noMatchingCommands": "Nenhum comando corresponde",
  "palette.goToFile": "Ir para o arquivo…",
  "palette.openFolderFirst": "Abra uma pasta primeiro",
  "palette.scanningVault": "Escaneando o cofre…",
  "palette.cantReadVault": "Não foi possível ler o cofre: {message}",
  "palette.noFilesFound": "Nenhum arquivo encontrado",

  // Palette commands
  "command.goToEditor": "Ir para o editor",
  "command.goToAgenda": "Ir para tarefas e calendário",
  "command.goToSearch": "Ir para a busca",
  "command.goToSettings": "Ir para as configurações",
  "command.editorAction": "Editor: {name}",
  "command.settingsSection": "Configurações: {name}",
  "command.openFolder": "Abrir pasta…",
  "command.quickOpen": "Abertura rápida: ir para o arquivo…",
  "command.closeActiveTab": "Fechar a aba ativa",
  "command.closeAllTabs": "Fechar todas as abas",
  "command.openDailyNote": "Abrir a nota diária de hoje",
  "command.newFromTemplate": "Nova nota a partir do modelo: {name}",
  "command.keyboardShortcuts": "Atalhos de teclado",
  "command.openInNewWindow": "Abrir em nova janela",
  "command.toggleTheme": "Alternar tema (claro / escuro)",
  "command.saveFile": "Salvar arquivo",
  "command.saveAndCloseTab": "Salvar e fechar a aba",
  "command.goToLine": "Ir para a linha {n}",

  // Search panel
  "search.openFolderToSearch": "Abra uma pasta para buscar",
  "search.placeholder": "Buscar nos arquivos…",
  "search.findReplaceTitle": "Localizar e substituir em todo o cofre",
  "search.replaceWith": "Substituir por…",
  "search.replaceAll": "Substituir tudo",
  "search.searching": "Buscando…",
  "search.typeToSearch": "Digite para buscar em todos os arquivos.",
  "search.noMatches": "Nenhum resultado.",
  "search.line": "linha {n}",
  "search.scopeInFile": "em {file}",
  "search.scopeAcrossFiles": "em {files}",
  "search.confirmReplace":
    'Substituir toda ocorrência de "{query}" por "{replacement}" {scope}? Isso não pode ser desfeito.',
  "search.replaced": "{occurrences} substituída(s) em {files}.",
  "search.replaceFailed": "Falha ao substituir: {error}",
  "search.replaceAllInFile": "Substituir tudo em {file}",
  "search.replaceInThisFile": "Substituir neste arquivo…",

  // Agenda
  "agenda.openFolder": "Abra uma pasta para ver tarefas e eventos",
  "agenda.emptyItem": "(vazio)",
  "agenda.recurringTask": "Tarefa recorrente",
  "agenda.routines": "Rotinas",
  "agenda.noRoutinesPrefix": "Ainda não há rotinas. Adicione",
  "agenda.noRoutinesSuffix": "a uma tarefa.",
  "agenda.noTasksPrefix": "Ainda não há tarefas. Use",
  "agenda.or": "ou",
  "agenda.noTasksSuffix": "nas suas notas.",
  "agenda.overdue": "Atrasadas",
  "agenda.today": "Hoje",
  "agenda.upcoming": "Próximas",
  "agenda.noDate": "Sem data",
  "agenda.nothingHere": "Nada por aqui.",
  "agenda.clearFilter": "Limpar filtro ({date})",
  "agenda.weekdayLetters": "D,S,T,Q,Q,S,S",

  // Tags
  "tags.openFolder": "Abra uma pasta para ver as tags",
  "tags.noTagsPrefix": "Ainda não há tags. Use",
  "tags.noTagsMid": "em uma nota ou uma lista",
  "tags.noTagsSuffix": "no frontmatter.",
  "tags.selectTag": "Selecione uma tag para ver suas notas.",

  // Settings navigation
  "settingsNav.appearance": "Aparência",
  "settingsNav.editor": "Editor",
  "settingsNav.shortcuts": "Atalhos de teclado",
  "settingsNav.vault": "Cofre",
  "settingsNav.integrations": "Integrações",
  "settingsNav.about": "Sobre",

  // Settings view
  "settings.searchPlaceholder": "Buscar configurações…",
  "settings.noResults": 'Nenhuma configuração corresponde a "{query}".',
  "settings.sectionsAria": "Seções de configurações",

  // Settings › Language
  "settings.language.title": "Idioma",
  "settings.language.desc":
    'Idioma da interface do aplicativo. "Sistema" segue o idioma do seu sistema operacional.',
  "settings.language.label": "Idioma",
  "settings.language.system": "Sistema",

  // Settings › Theme
  "settings.theme.title": "Tema",
  "settings.theme.desc":
    "Um tema é uma escolha de cores, independente do modo claro/escuro. Cada paleta pode ter uma variante clara e/ou escura.",
  "settings.theme.palette": "Paleta",
  "settings.theme.paletteCustom": "Personalizada",
  "settings.theme.mode": "Modo",
  "settings.theme.modeSystem": "Sistema",
  "settings.theme.modeLight": "Claro",
  "settings.theme.modeDark": "Escuro",
  "settings.theme.draculaHint":
    "Dracula só tem paleta escura, então o modo fica fixo em escuro.",
  "settings.theme.customCss": "Variáveis CSS personalizadas",
  "settings.theme.customCssHintPrefix":
    "As declarações são injetadas como estão na regra",
  "settings.theme.customCssHintSuffix":
    "do tema. A pré-visualização atualiza enquanto você digita; clique em Aplicar para usar no aplicativo inteiro.",

  // Settings shared preview card
  "settings.preview.primary": "Primário",
  "settings.preview.secondary": "Secundário",
  "settings.preview.pangram":
    "Um pequeno jabuti xereta viu dez cegonhas felizes.",

  // Settings › Font
  "settings.font.title": "Fonte",
  "settings.font.desc":
    "Escolha fontes instaladas nesta máquina para a interface do aplicativo e para o editor.",
  "settings.font.uiFont": "Fonte da interface",
  "settings.font.editorFont": "Fonte do editor",
  "settings.font.loading": "Carregando as fontes do sistema…",
  "settings.font.error":
    "Não foi possível listar as fontes do sistema: {message}",
  "settings.font.editorFontSize": "Tamanho da fonte do editor",
  "settings.font.editorFontSizeHint":
    "Também Cmd/Ctrl +, − e 0 para redefinir.",
  "settings.font.uiZoom": "Zoom da interface",
  "settings.font.uiZoomHint":
    "Em porcentagem. Também Cmd/Ctrl Shift +, − e 0 para redefinir.",

  // Settings › Keybindings
  "settings.keybindings.title": "Mapeamento de teclas",
  "settings.keybindings.desc":
    "Escolha como o editor interpreta as teclas. Vale imediatamente em qualquer arquivo aberto.",
  "settings.keybindings.helixDesc":
    "Edição modal, comandos no estilo Helix (seleção primeiro).",
  "settings.keybindings.vimDesc": "Edição modal, atalhos do Vim.",
  "settings.keybindings.normalLabel": "Normal",
  "settings.keybindings.normalDesc":
    "Atalhos padrão de editor de texto, sem modos.",

  // Settings › Editor behavior
  "settings.behavior.title": "Comportamento do editor",
  "settings.behavior.desc":
    "Preferências de numeração de linhas e indentação do editor.",
  "settings.behavior.relativeLineNumbers": "Números de linha relativos",
  "settings.behavior.absolute": "Absolutos",
  "settings.behavior.absoluteTitle": "Cada linha mostra seu número absoluto.",
  "settings.behavior.relative": "Relativos",
  "settings.behavior.relativeTitle":
    "A linha atual mostra seu número absoluto; as demais mostram a distância até o cursor.",
  "settings.behavior.relativeHint":
    "No estilo Helix/Vim: útil para saltar N linhas com comandos de movimento.",
  "settings.behavior.tabSize": "Tamanho da tabulação",
  "settings.behavior.tabSizeHint":
    "Espaços por nível de indentação e por parada de tabulação.",

  // Settings › Fold regions
  "settings.folding.title": "Regiões dobráveis",
  "settings.folding.desc":
    "Coloque linhas entre um marcador de início e um de fim para torná-las dobráveis — é uma convenção do aplicativo, não faz parte do Markdown. O resto da linha do marcador de início vira o nome da região.",
  "settings.folding.startMarker": "Marcador de início",
  "settings.folding.endMarker": "Marcador de fim",
  "settings.folding.eg": "ex.:",
  "settings.folding.regionName": "Nome da região",
  "settings.folding.expanded": "Expandida",
  "settings.folding.collapsed": "Recolhida",
  "settings.folding.linesExample": "3 linhas",

  // Settings › Vault folders
  "settings.vault.title": "Pastas do cofre",
  "settings.vault.descPrefix":
    'Relativas ao cofre aberto. "Abrir a nota diária de hoje" e "Nova nota a partir do modelo" ficam na paleta de comandos (Cmd/Ctrl-Shift-P); os modelos podem usar',
  "settings.vault.and": "e",
  "settings.vault.descImages": ". Imagens coladas vão para",
  "settings.vault.dailyNotesFolder": "Pasta de notas diárias",
  "settings.vault.templatesFolder": "Pasta de modelos",
  "settings.vault.templatesHintPrefix": "Um arquivo",
  "settings.vault.templatesHintSuffix":
    "aqui serve de base para novas notas diárias.",
  "settings.vault.externalTool": "Ferramenta externa",
  "settings.vault.externalToolPlaceholder":
    'ex.: "Visual Studio Code" (vazio = padrão do sistema)',
  "settings.vault.externalToolHint":
    'Usada por "Abrir com…" no menu de contexto do explorador de arquivos.',

  // Settings › About
  "settings.about.title": "Sobre",
  "settings.about.desc":
    "Fuchico {version} — um aplicativo de notas Markdown focado no teclado, com edição Helix, tarefas e agenda.",
  "settings.about.github": "Código-fonte e issues no GitHub",

  // Settings › Keyboard shortcuts
  "shortcuts.title": "Atalhos de teclado",
  "shortcuts.desc":
    "Tudo o que o teclado pode fazer, em um só lugar. As ações do editor são reconfiguráveis: clique em um atalho e pressione a nova combinação de teclas.",
  "shortcuts.searchPlaceholder": "Buscar atalhos…",
  "shortcuts.editorRebindable": "Editor (reconfigurável)",
  "shortcuts.pressKeys": "Pressione as teclas…",
  "shortcuts.noMatch": 'Nenhum atalho corresponde a "{query}".',
  "shortcuts.group.global": "Global",
  "shortcuts.group.editor": "Editor",
  "shortcuts.group.explorer": "Explorador de arquivos",
  "shortcuts.group.tabs": "Abas",
  "shortcuts.fixed.commandPalette.label": "Paleta de comandos",
  "shortcuts.fixed.commandPalette.desc":
    "Execute qualquer comando do aplicativo pelo nome.",
  "shortcuts.fixed.quickOpen.label": "Abertura rápida de arquivo",
  "shortcuts.fixed.quickOpen.desc":
    "Encontre uma nota no cofre por busca aproximada.",
  "shortcuts.fixed.editorFontSize.label": "Tamanho da fonte do editor",
  "shortcuts.fixed.editorFontSize.desc":
    "Aumentar / diminuir / redefinir o texto do editor.",
  "shortcuts.fixed.uiZoom.label": "Zoom da interface",
  "shortcuts.fixed.uiZoom.desc":
    "Ampliar / reduzir / redefinir o aplicativo inteiro.",
  "shortcuts.fixed.helixPalette.label": "Paleta de comandos pelo Helix",
  "shortcuts.fixed.helixPalette.desc":
    "No modo normal do Helix, : abre a paleta de comandos; :q, :w, :wq e :<linha> funcionam como apelidos.",
  "shortcuts.fixed.save.label": "Salvar",
  "shortcuts.fixed.save.desc": "Grava o arquivo atual no disco.",
  "shortcuts.fixed.findReplace.label": "Localizar / substituir",
  "shortcuts.fixed.findReplace.desc": "Busca dentro do arquivo atual.",
  "shortcuts.fixed.taskAutocomplete.label":
    "Autocompletar data / repetição de tarefa",
  "shortcuts.fixed.taskAutocomplete.desc":
    "Digite @due, @today, @repeat (ou 📅 / 🔁) em uma linha de tarefa para escolher uma data ou regra.",
  "shortcuts.fixed.pasteImage.label": "Colar imagem",
  "shortcuts.fixed.pasteImage.desc":
    "Cole ou arraste uma imagem para salvá-la em attachments/ e criar o link.",
  "shortcuts.fixed.followLink.label": "Seguir link",
  "shortcuts.fixed.followLink.desc":
    "Abre o [[wikilink]] ou link Markdown sob o cursor.",
  "shortcuts.fixed.followLink.keys": "Clique",
  "shortcuts.fixed.explorerNavigate.label": "Navegar",
  "shortcuts.fixed.explorerNavigate.desc":
    "Move a seleção, expande/recolhe pastas.",
  "shortcuts.fixed.explorerOpen.label": "Abrir / alternar pasta",
  "shortcuts.fixed.explorerOpen.desc":
    "Abre o arquivo selecionado ou expande/recolhe a pasta.",
  "shortcuts.fixed.explorerRename.label": "Renomear",
  "shortcuts.fixed.explorerRename.desc": "Renomeia o item selecionado.",
  "shortcuts.fixed.explorerDelete.label": "Excluir",
  "shortcuts.fixed.explorerDelete.desc":
    "Exclui o item selecionado (pede confirmação).",
  "shortcuts.fixed.explorerTypeAhead.label": "Busca por prefixo",
  "shortcuts.fixed.explorerTypeAhead.desc":
    "Digite o início de um nome para pular até o item correspondente.",
  "shortcuts.fixed.explorerMenu.label": "Menu de contexto",
  "shortcuts.fixed.explorerMenu.desc": "Novo arquivo/pasta, renomear, excluir.",
  "shortcuts.fixed.explorerMenu.keys": "Clique direito",
  "shortcuts.fixed.tabMenu.label": "Menu da aba",
  "shortcuts.fixed.tabMenu.desc": "Fechar, fechar outras, fechar todas.",
  "shortcuts.fixed.tabMenu.keys": "Clique direito",

  // Rebindable editor actions
  "shortcutAction.openOutline.label": "Ir para o cabeçalho",
  "shortcutAction.openOutline.desc":
    "Abre o sumário do documento (lista de cabeçalhos com busca aproximada).",
  "shortcutAction.toggleCheckboxAtCursor.label": "Alternar checkbox",
  "shortcutAction.toggleCheckboxAtCursor.desc":
    "Marca/desmarca o checkbox na linha do cursor.",
  "shortcutAction.insertDate.label": "Inserir data",
  "shortcutAction.insertDate.desc": "Insere a data de hoje no cursor.",
  "shortcutAction.insertDateTime.label": "Inserir data e hora",
  "shortcutAction.insertDateTime.desc":
    "Insere a data e a hora atuais no cursor.",
  "shortcutAction.insertRegion.label": "Inserir região dobrável",
  "shortcutAction.insertRegion.desc":
    "Envolve as linhas selecionadas em uma região dobrável (ou insere uma vazia no cursor).",
  "shortcutAction.insertTable.label": "Inserir tabela",
  "shortcutAction.insertTable.desc":
    "Insere uma tabela Markdown 2x2 no cursor e começa a editar o cabeçalho.",
  "shortcutAction.toggleTaskLine.label": "Alternar tarefa",
  "shortcutAction.toggleTaskLine.desc":
    "Transforma a linha atual em uma tarefa `- [ ]` (ou de volta em texto simples).",
  "shortcutAction.pickDueDate.label": "Definir prazo…",
  "shortcutAction.pickDueDate.desc":
    "Adiciona ou altera a data 📅 de prazo na linha atual por uma lista de escolha rápida.",
  "shortcutAction.pickRecurrence.label": "Definir recorrência…",
  "shortcutAction.pickRecurrence.desc":
    "Adiciona ou altera a regra 🔁 de repetição na linha atual por uma lista de escolha rápida.",
};
