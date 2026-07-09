// ═══════════════════════════════════════════════════════════════
//  icsExport — génération d'un fichier .ics (RFC 5545) pour UN créneau.
//
//  PUR CLIENT : aucune écriture Firestore, aucune API externe, aucune
//  permission. On fabrique un VEVENT en heures LOCALES FLOTTANTES
//  (Europe/Paris implicite : pas de suffixe Z, pas de VTIMEZONE) puis on
//  déclenche un téléchargement → l'agenda natif du smartphone l'importe.
// ═══════════════════════════════════════════════════════════════

export function creneauToICS({ chantierNom, chantierAdresse, posteLabel,
  batiment, ressourceNom, dateIso, periode }) {
  // Heures locales flottantes (Europe/Paris implicite, pas de Z, pas de VTIMEZONE).
  const d = new Date(dateIso + "T00:00:00");
  const isFri = d.getDay() === 5;
  const startH = periode === "AM" ? 8 : 13;
  const durMin = (isFri ? (periode === "PM" ? 3 : 4) : 4) * 60;   // Ven : 4h matin, 3h aprem
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = dateIso.replace(/-/g, "");
  const startMin = startH * 60;
  const endMin = startMin + durMin;
  const hhmm = (m) => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const dtStart = `${ymd}T${hhmm(startMin)}`;
  const dtEnd   = `${ymd}T${hhmm(endMin)}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${dateIso}-${periode}-${(chantierNom||"epj").replace(/\s/g,"")}-${Date.now()}@epj-planning`;
  const summary = posteLabel ? `${chantierNom} — ${posteLabel}` : `EPJ — ${chantierNom}`;
  const descParts = [batiment && `Bâtiment ${batiment}`, ressourceNom && `Ressource : ${ressourceNom}`].filter(Boolean);
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//EPJ//Planning//FR","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,`DTEND:${dtEnd}`,
    `SUMMARY:${esc(summary)}`,
    chantierAdresse ? `LOCATION:${esc(chantierAdresse)}` : "",
    descParts.length ? `DESCRIPTION:${esc(descParts.join(" · "))}` : "",
    "END:VEVENT","END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function triggerAddToCalendar(ics, filename = "evenement-epj.ics") {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
