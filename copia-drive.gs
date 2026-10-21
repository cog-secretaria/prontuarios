/**
 * Arquivo de Prontuários: cópia de segurança automática no Google Drive.
 *
 * Toda noite, este script entra no Firebase com um login só de Consulta, lê todas as abas
 * e salva uma planilha completa (a mesma do botão "Baixar cópia completa") numa pasta do Drive.
 * Guarda as 60 cópias mais recentes. A planilha serve para "Restaurar" no app.
 * Junto vai uma segunda planilha, só para consulta, com as pastas que estão fora do arquivo
 * (com quem e desde quando) e as faixas de "onde ficam as pastas".
 * Toda segunda-feira, manda também uma cópia por e-mail para os endereços em COPIA_EMAIL
 * (de preferência uma conta fora da conta Google da escola): se essa conta for perdida,
 * a lista continua guardada em outro lugar.
 *
 * Como instalar: veja "Cópia automática no Drive" no LEIA-ME.md.
 */

// Preencha com os mesmos valores do config.js.
const CONFIG = {
  apiKey: "AIzaSyAUVEtcVZJBgOu5OUqP_cTeJBbdb7hp2AA",
  projectId: "prontuarios-cog",
  escola: "principal",
  pasta: "Cópias do Arquivo de Prontuários",
  guardar: 60
};

const ABAS = [
  ["lotes", "ALUNOS"],
  ["l_antigo", "ANTIGO GRUPO ESCOLAR"],
  ["l_grupao", "PROFESSORES GRUPÃO"],
  ["l_cog", "PROFESSORES COG"],
  ["l_avulsas", "PASTAS AVULSAS"]
];

/** Para testar o e-mail: faz uma cópia agora e manda por e-mail mesmo que não seja segunda-feira. */
function testarCopiaPorEmail() {
  PropertiesService.getScriptProperties().setProperty("COPIA_EMAIL_AGORA", "sim");
  return fazerCopia();
}

/** Rode esta uma vez: agenda a cópia para toda noite e já faz a primeira. */
function instalarCopiaDiaria() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "fazerCopia")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("fazerCopia").timeBased().everyDays(1).atHour(22).create();
  fazerCopia();
}

function fazerCopia() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty("ROBO_EMAIL"), senha = props.getProperty("ROBO_SENHA");
  if (!email || !senha) throw new Error("Falta ROBO_EMAIL ou ROBO_SENHA nas Propriedades do script.");
  // Endereços do Google; só mudam nos testes.
  const authUrl = props.getProperty("AUTH_URL") || "https://identitytoolkit.googleapis.com";
  const dbUrl = props.getProperty("FIRESTORE_URL") || "https://firestore.googleapis.com";

  const login = pedir(authUrl + "/v1/accounts:signInWithPassword?key=" + CONFIG.apiKey, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ email: email, password: senha, returnSecureToken: true })
  });
  const cab = { Authorization: "Bearer " + login.idToken };
  const base = dbUrl + "/v1/projects/" + CONFIG.projectId + "/databases/(default)/documents/prontuarios/" + CONFIG.escola + "/";

  const linhas = [["Aba", "Nome", "Nº", "Responsável", "Observação", "Nascimento"]];
  ABAS.forEach(function (aba) {
    lerColecao(base + aba[0], cab).forEach(function (d) {
      const a = (((d.fields || {}).a || {}).arrayValue || {}).values || [];
      a.forEach(function (v) {
        const f = (v.mapValue || {}).fields || {};
        linhas.push([aba[1], valor(f.nome), valor(f.n), valor(f.resp), valor(f.obs), valor(f.nasc)]);
      });
    });
  });
  // Nunca troca uma cópia boa por uma vazia (ex.: login sem acesso).
  if (linhas.length < 2) throw new Error("Nenhum cadastro lido. Confira se o login da cópia tem acesso no app.");

  // Segunda planilha: pastas fora do arquivo e onde ficam as pastas.
  const titulos = { alunos: "ALUNOS", antigo: "ANTIGO GRUPO ESCOLAR", grupao: "PROFESSORES GRUPÃO", cog: "PROFESSORES COG", avulsas: "PASTAS AVULSAS" };
  const extras = [["Tipo", "Aba", "Nº", "Nome", "Com quem / Local", "Motivo", "Desde"]];
  lerColecao(base + "retiradas", cab).forEach(function (d) {
    const f = d.fields || {}, desde = Number(valor(f.desde));
    extras.push(["Pasta fora do arquivo", titulos[valor(f.aba)] || valor(f.aba), valor(f.numero), valor(f.nome), valor(f.com), valor(f.motivo),
      desde ? Utilities.formatDate(new Date(desde), "America/Sao_Paulo", "dd/MM/yyyy") : ""]);
  });
  const locais = pedir(base + "config/locais", { headers: cab }, true);
  Object.keys((locais && locais.fields) || {}).forEach(function (k) {
    valor(locais.fields[k]).split(/\r?\n/).filter((l) => l.trim()).forEach((l) => extras.push(["Onde ficam as pastas", titulos[k] || k, "", "", l.trim(), "", ""]));
  });

  const agora = new Date(), quando = Utilities.formatDate(agora, "America/Sao_Paulo", "yyyy-MM-dd-HHmm");
  const nome = "prontuarios-completo-" + quando + ".csv";
  const pasta = pastaDasCopias();
  const blob = Utilities.newBlob(paraCsv(linhas), "text/csv", nome);
  const blobExtras = Utilities.newBlob(paraCsv(extras), "text/csv", "prontuarios-retiradas-e-locais-" + quando + ".csv");
  pasta.createFile(blob);
  pasta.createFile(blobExtras);

  // Cópia semanal por e-mail, guardada fora do Drive da escola.
  const destinos = (props.getProperty("COPIA_EMAIL") || "").trim();
  if (destinos && (agora.getDay() === 1 || props.getProperty("COPIA_EMAIL_AGORA") === "sim")) {
    MailApp.sendEmail({
      to: destinos,
      subject: "Cópia semanal do Arquivo de Prontuários — " + Utilities.formatDate(agora, "America/Sao_Paulo", "dd/MM/yyyy"),
      body: "Cópia completa do Arquivo de Prontuários (" + (linhas.length - 1) + " cadastros), gerada automaticamente.\n\n" +
        "Guarde este e-mail. Se um dia os dados do app se perderem, a secretaria abre o app, vai em ACESSO → Restaurar " +
        "e escolhe a planilha anexa.\n\nContém nomes de alunos: não encaminhe.",
      attachments: [blob, blobExtras]
    });
    props.deleteProperty("COPIA_EMAIL_AGORA");
  }

  // Guarda só as mais recentes de cada tipo.
  ["prontuarios-completo-", "prontuarios-retiradas-e-locais-"].forEach(function (prefixo) {
    const arquivos = [];
    const it = pasta.getFiles();
    while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(prefixo) === 0 && /\.csv$/.test(f.getName())) arquivos.push(f); }
    arquivos.sort((x, y) => (x.getName() < y.getName() ? 1 : -1)).slice(CONFIG.guardar).forEach((f) => f.setTrashed(true));
  });

  // Avisa o app que a cópia foi feita (some o lembrete de cópia).
  pedir(base + "meta/copia-auto?updateMask.fieldPaths=quando", {
    method: "patch", contentType: "application/json", headers: cab,
    payload: JSON.stringify({ fields: { quando: { integerValue: String(agora.getTime()) } } })
  });
  return { arquivo: nome, cadastros: linhas.length - 1, extras: extras.length - 1 };
}

// Lê todos os documentos de uma coleção, página por página, em ordem.
function lerColecao(url, cab) {
  const docs = [];
  let pagina = "";
  do {
    const r = pedir(url + "?pageSize=100" + (pagina ? "&pageToken=" + encodeURIComponent(pagina) : ""), { headers: cab });
    (r.documents || []).forEach((d) => docs.push(d));
    pagina = r.nextPageToken || "";
  } while (pagina);
  return docs.sort((x, y) => (x.name < y.name ? -1 : 1));
}

function paraCsv(linhas) {
  return "\uFEFF" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}

function pastaDasCopias() {
  const it = DriveApp.getFoldersByName(CONFIG.pasta);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.pasta);
}

function pedir(url, opcoes, podeFaltar) {
  opcoes.muteHttpExceptions = true;
  const r = UrlFetchApp.fetch(url, opcoes), cod = r.getResponseCode(), txt = r.getContentText();
  if (cod === 404 && podeFaltar) return null;
  if (cod >= 300) throw new Error("Erro " + cod + " ao acessar o Firebase: " + txt.slice(0, 300));
  return txt ? JSON.parse(txt) : {};
}

function valor(v) {
  if (!v) return "";
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return String(v.integerValue);
  if ("doubleValue" in v) return String(v.doubleValue);
  return "";
}

function celula(s) {
  s = String(s == null ? "" : s);
  if (/^[=+@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
