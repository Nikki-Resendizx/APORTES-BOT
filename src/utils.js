function fullName(u){ return [u.first_name,u.last_name].filter(Boolean).join(" ") || "Sin nombre"; }
function stamp(){ return new Intl.DateTimeFormat("es-MX",{timeZone:"America/Mexico_City",dateStyle:"short",timeStyle:"medium",hour12:false}).format(new Date()); }
function vars(text,u){ return String(text||"").replaceAll("#mencion",fullName(u)).replaceAll("#nombre",fullName(u)).replaceAll("#username",u.username ? "@"+u.username : "Sin username").replaceAll("#userid",String(u.id)); }
function topicName(u){ return (fullName(u)+" • "+u.id).slice(0,128); }
function registration(u){ return ["👤 NUEVO USUARIO","",`👤 Nombre: ${fullName(u)}`,`🆔 ID: ${u.id}`,`🔗 Username: ${u.username ? "@"+u.username : "Sin username"}`,`⭐ Premium: ${u.is_premium ? "Sí":"No"}`,`📅 Registro: ${stamp()}`,`🌎 Zona horaria: America/Mexico_City`].join("\n"); }
module.exports={fullName,stamp,vars,topicName,registration};
