function fullName(u){ return [u.first_name,u.last_name].filter(Boolean).join(" ") || "Sin nombre"; }
function stamp(){ return new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",dateStyle:"short",timeStyle:"medium",hour12:false}).format(new Date()); }
function escapeHtml(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function mention(u){
  return '<a href="tg://user?id='+String(u.id)+'">'+escapeHtml(fullName(u))+'</a>';
}
function varsHtml(text,u){
  return String(text||"")
    .replaceAll("{mencion}",mention(u))
    .replaceAll("{nombre}",escapeHtml(fullName(u)))
    .replaceAll("{username}",escapeHtml(u.username ? "@"+u.username : "Sin username"))
    .replaceAll("{userid}",String(u.id));
}
function hasVars(text){
  return /\{(?:mencion|nombre|username|userid)\}/i.test(String(text||""));
}
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
  for(const e of list){
    events.push({at:e.offset,type:"open",e});
    events.push({at:e.offset+e.length,type:"close",e});
  }
  events.sort((a,b)=>a.at-b.at || (a.type==="close"?-1:1) || (a.type==="open" ? a.e.length-b.e.length : b.e.length-a.e.length));
  let out="", pos=0;
  const stack=[];
  for(const ev of events){
    const at=Math.max(0,Math.min(text.length,ev.at));
    if(at>pos) out+=escapeHtml(text.slice(pos,at));
    if(ev.type==="open"){ out+="\u0001"+list.indexOf(ev.e)+"\u0002"; stack.push(ev.e); }
    else {
      out+="\u0003"+list.indexOf(ev.e)+"\u0004";
      const i=stack.lastIndexOf(ev.e); if(i>=0) stack.splice(i,1);
    }
    pos=at;
  }
  out+=escapeHtml(text.slice(pos));
  for(const e of list){
    const open="\u0001"+list.indexOf(e)+"\u0002";
    const close="\u0003"+list.indexOf(e)+"\u0004";
    out=out.split(open).join("<"+(e.type==="blockquote"?"blockquote":e.type==="expandable_blockquote"?"blockquote expandable":e.type==="pre"?"pre":e.type==="bold"?"b":e.type==="italic"?"i":e.type==="underline"?"u":e.type==="strikethrough"?"s":e.type==="spoiler"?"tg-spoiler":e.type==="code"?"code":e.type==="text_link"?"a":e.type==="text_mention"?"a":e.type==="custom_emoji"?"tg-emoji":(e.type==="url"||e.type==="email"||e.type==="phone_number")?"a":"span")+">");
    out=out.split(close).join("</"+(e.type==="expandable_blockquote"||e.type==="blockquote"?"blockquote":e.type==="pre"?"pre":e.type==="bold"?"b":e.type==="italic"?"i":e.type==="underline"?"u":e.type==="strikethrough"?"s":e.type==="spoiler"?"tg-spoiler":e.type==="code"?"code":e.type==="text_link"||e.type==="text_mention"||e.type==="url"||e.type==="email"||e.type==="phone_number"?"a":e.type==="custom_emoji"?"tg-emoji":"span")+">");
  }
  return out;
}
function formatMessageHtml(text,entities,u){
  return varsHtml(entitiesToHtml(text,entities),u);
}
function topicName(u){ return (fullName(u)+" • "+u.id).slice(0,128); }
function registration(u){
  return ["👤 NUEVO USUARIO","",`👤 Nombre: ${mention(u)}`,`🆔 ID: ${u.id}`,`🔗 Username: ${u.username ? escapeHtml("@"+u.username) : "Sin username"}`,`⭐ Premium: ${u.is_premium ? "Sí":"No"}`,`📅 Registro: ${stamp()}`,`🌎 Zona horaria: America/Mexico_City`].join("\n");
}
module.exports={fullName,stamp,escapeHtml,mention,varsHtml,hasVars,entitiesToHtml,formatMessageHtml,topicName,registration};
