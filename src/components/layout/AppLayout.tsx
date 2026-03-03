import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/planning": "Planning",
  "/transport": "Transportmateriaal",
  "/voertuigen": "Voertuigen",
  "/chauffeurs": "Chauffeurs",
  "/locaties": "Locaties",
  "/route-builder": "Route Builder",
  "/onderhoud": "Onderhoud",
  "/rapportages": "Rapportages",
  "/documenten": "Documenten",
  "/instellingen": "Instellingen",
};

// Pages that manage their own padding (full-bleed layout)
const fullBleedPages = new Set(['/route-builder', '/dagplanning']);

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Pagina";
  const isFullBleed = fullBleedPages.has(location.pathname);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="font-semibold">{pageTitle}</h1>
          </header>
          <main className={isFullBleed ? "flex-1" : "flex-1 p-6"}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
