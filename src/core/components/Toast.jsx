// Toast simple, utilisé via un hook léger dans le Layout
import { createContext, useContext, useState, useCallback } from "react";
import { EPJ } from "../theme";

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m, ms = 2000) => {
    setMsg(m);
    setTimeout(() => setMsg(null), ms);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: EPJ.gray900, color: "#fff",
          padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 500,
          letterSpacing: "-0.01em", zIndex: 1000, animation: "fadeUp .25s ease",
          boxShadow: "0 10px 30px rgba(0,0,0,.15)",
        }}>
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}
