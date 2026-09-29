const GIST_ID = "7c68734989e5d53c30ceebf6bb1a314d";
const TOKEN = process.env.GITHUB_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

const ID_OK = /^B[1-6]$/;

// Compare l'ancien et le nouvel etat, et construit le message a envoyer (ou null).
// Seuls les identifiants B1 a B6 sont pris en compte, et aucun texte libre
// (comme un prenom) n'est jamais repris dans le message.
function buildMessage(prev, next) {
  if (!prev || !next || typeof prev !== "object" || typeof next !== "object") return null;
  const freed = [];
  const done = [];
  for (const id of Object.keys(next)) {
    if (!ID_OK.test(id)) continue;
    const before = prev[id] && prev[id].status;
    const after = next[id] && next[id].status;
    if (!before || !after || before === after) continue;
    if (after === "libre" && (before === "occupe" || before === "signale")) freed.push(id);
    else if (after === "signale" && before === "occupe") done.push(id);
  }
  const lines = [];
  done.sort().forEach((id) => lines.push("🔌 " + id + " : charge terminée, merci de débrancher"));
  if (freed.length === 1) lines.push("🟢 " + freed[0] + " est libre");
  else if (freed.length > 1) lines.push("🟢 Bornes libres : " + freed.sort().join(", "));
  return lines.length ? lines.join("\n") : null;
}

// L'envoi ne doit jamais faire echouer la sauvegarde de l'etat.
async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT || !text) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("telegram notify failed:", e && e.name);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Authorization": `token ${TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  if (req.method === "GET") {
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    if (!r.ok) return res.status(500).json({ error: "gist read failed" });
    const data = await r.json();
    const content = JSON.parse(data.files["bornes.json"].content);
    return res.status(200).json(content);
  }

  if (req.method === "PATCH") {
    const state = req.body;

    // Ancien etat, lu avant l'ecriture, pour detecter les changements.
    let prev = null;
    try {
      const r0 = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
      if (r0.ok) prev = JSON.parse((await r0.json()).files["bornes.json"].content);
    } catch (e) {
      prev = null;
    }

    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ files: { "bornes.json": { content: JSON.stringify(state) } } }),
    });
    if (!r.ok) return res.status(500).json({ error: "gist write failed" });

    await notify(buildMessage(prev, state));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
