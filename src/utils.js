function fullName(u){ return [u.first_name,u.last_name].filter(Boolean).join(" ") || "Sin nombre"; }
function stamp(date = new Date()){ return new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",dateStyle:"short",timeStyle:"medium",hour12:false}).format(new Date(date)); }
function escapeHtml(value){ return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function mention(u){ return '<a href="tg://user?id='+String(u.id)+'">'+escapeHtml(fullName(u))+'</a>'; }

function varsHtml(text,u){
  const banned = !!u?.banned;
  const status = banned ? "Baneado" : (u?.blocked ? "No disponible" : "Activo");
  const bio = u?.bio ? escapeHtml(u.bio) : "";
  return String(text||"")
    .replaceAll("{mencion}",mention(u))
    .replaceAll("{nombre}",escapeHtml(fullName(u)))
    .replaceAll("{username}",escapeHtml(u.username ? "@"+u.username : "Sin username"))
    .replaceAll("{userid}",String(u.id))
    .replaceAll("{premium}",u.is_premium ? "Sí" : "No")
    .replaceAll("{idioma}",escapeHtml(u.language_code || u.languageCode || "No disponible"))
    .replaceAll("{registro}",escapeHtml(stamp(u.createdAt || new Date())))
    .replaceAll("{biografia}",bio)
    .replaceAll("{estado}",escapeHtml(status))
    .replaceAll("{timezone}",escapeHtml("America/Mexico_City"));
}
function hasVars(text){ return /\{(?:mencion|nombre|username|userid|premium|idioma|registro|biografia|estado)\}/i.test(String(text||"")); }

function entityTag(entity, inner){
  const type=entity.type;
  if(type==="bold") return "<b>"+inner+"</b>";
  if(type==="italic") return "<i>"+inner+"</i>";
  if(type==="underline") return "<u>"+inner+"</u>";
  if(type==="strikethrough") return "<s>"+inner+"</s>";
  if(type==="spoiler") return "<tg-spoiler>"+inner+"</tg-spoiler>";
  if(type==="code") return "<code>"+inner+"</code>";
  if(type==="pre") return entity.language ? '<pre><code class="language-'+escapeHtml(entity.language)+'">'+inner+"</code></pre>" : "<pre>"+inner+"</pre>";
  if(type==="text_link") return '<a href="'+escapeHtml(entity.url)+'">'+inner+"</a>";
  if(type==="text_mention") return '<a href="tg://user?id='+String(entity.user?.id||"")+'">'+inner+"</a>";
  if(type==="url" || type==="email" || type==="phone_number") return "<a href=\""+escapeHtml(inner)+"\">"+inner+"</a>";
  if(type==="custom_emoji") return '<tg-emoji emoji-id="'+String(entity.custom_emoji_id||"")+'">'+inner+"</tg-emoji>";
  if(type==="blockquote") return "<blockquote>"+inner+"</blockquote>";
  if(type==="expandable_blockquote") return "<blockquote expandable>"+inner+"</blockquote>";
  return inner;
}
function entitiesToHtml(text,entities=[]){
  const list=[...(entities||[])].filter(e=>e && e.length>0).sort((a,b)=>a.offset-b.offset || b.length-a.length);
  if(!list.length) return escapeHtml(text);
  const events=[];
  for(const e of list){ events.push({at:e.offset,type:"open",e}); events.push({at:e.offset+e.length,type:"close",e}); }
  events.sort((a,b)=>a.at-b.at || (a.type===b.type ? (a.type==="open" ? b.e.length-a.e.length : a.e.length-b.e.length) : (a.type==="close" ? -1 : 1)));
  let out="",pos=0;
  for(const ev of events){
    const at=Math.max(0,Math.min(text.length,ev.at));
    if(at>pos) out+=escapeHtml(text.slice(pos,at));
    if(ev.type==="open") out+="\u0001"+list.indexOf(ev.e)+"\u0002";
    else out+="\u0003"+list.indexOf(ev.e)+"\u0004";
    pos=at;
  }
  out+=escapeHtml(text.slice(pos));
  for(const e of list){
    const open="\u0001"+list.indexOf(e)+"\u0002", close="\u0003"+list.indexOf(e)+"\u0004";
    let openTag="",closeTag="";
    if(e.type==="bold"){openTag="<b>";closeTag="</b>";}
    else if(e.type==="italic"){openTag="<i>";closeTag="</i>";}
    else if(e.type==="underline"){openTag="<u>";closeTag="</u>";}
    else if(e.type==="strikethrough"){openTag="<s>";closeTag="</s>";}
    else if(e.type==="spoiler"){openTag="<tg-spoiler>";closeTag="</tg-spoiler>";}
    else if(e.type==="code"){openTag="<code>";closeTag="</code>";}
    else if(e.type==="pre"){openTag=e.language ? '<pre><code class="language-'+escapeHtml(e.language)+'">' : "<pre>";closeTag=e.language ? "</code></pre>" : "</pre>";}
    else if(e.type==="text_link"){openTag='<a href="'+escapeHtml(e.url)+'">';closeTag="</a>";}
    else if(e.type==="text_mention"){openTag='<a href="tg://user?id='+String(e.user?.id||"")+'">';closeTag="</a>";}
    else if(e.type==="custom_emoji"){openTag='<tg-emoji emoji-id="'+String(e.custom_emoji_id||"")+'">';closeTag="</tg-emoji>";}
    else if(e.type==="blockquote"){openTag="<blockquote>";closeTag="</blockquote>";}
    else if(e.type==="expandable_blockquote"){openTag="<blockquote expandable>";closeTag="</blockquote>";}
    else if(e.type==="url" || e.type==="email" || e.type==="phone_number"){openTag='<a href="'+escapeHtml(text.slice(e.offset,e.offset+e.length))+'">';closeTag="</a>";}
    out=out.split(open).join(openTag);
    out=out.split(close).join(closeTag);
  }
  return out;
}
function formatMessageHtml(text,entities,u){ return varsHtml(entitiesToHtml(text,entities),u); }

const DEFAULT_REGISTRATION_TEMPLATE = [
  "👤 NUEVO USUARIO","",
  "📝 Nombre: {mencion}",
  "🔗 Username: {username}",
  "🆔 ID: {userid}",
  "⭐ Premium: {premium}",
  "🌐 Idioma: {idioma}",
  "📅 Registro: {registro}","",
  "📖 Biografía:",
  "{biografia}","",
  "🟢 Estado: {estado}"
].join("\n");

function registration(u, source){
  const text = source?.text || DEFAULT_REGISTRATION_TEMPLATE;
  return formatMessageHtml(text, source?.entities || [], u);
}
function topicName(u){ return (fullName(u)+" • "+u.id).slice(0,128); }
module.exports={fullName,stamp,escapeHtml,mention,varsHtml,hasVars,entitiesToHtml,formatMessageHtml,topicName,registration,DEFAULT_REGISTRATION_TEMPLATE};
