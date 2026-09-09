import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import "@/components/public/public-theme.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="publicScope" style={{ background: "#060914", color: "#eaf2fb", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0 clamp(20px, 5vw, 84px)" }}>
        <PublicHeader />
      </div>
      <div style={{ flex: 1 }}>
        {children}
      </div>
      <div style={{ padding: "0 clamp(20px, 5vw, 84px)" }}>
        <PublicFooter />
      </div>
    </div>
  );
}

