import { EPJ } from "../theme";

export function Spinner({ label, size = 18 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: EPJ.gray500, fontSize: 13, fontWeight: 500 }}>
      <div style={{
        width: size, height: size,
        border: `2.5px solid ${EPJ.gray200}`,
        borderTopColor: EPJ.blue,
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }}/>
      {label && <span>{label}</span>}
    </div>
  );
}

export function FullPageSpinner({ label = "Chargement…" }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: EPJ.white,
    }}>
      <Spinner label={label} size={26}/>
    </div>
  );
}
