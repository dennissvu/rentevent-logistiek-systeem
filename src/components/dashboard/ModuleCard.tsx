import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, LucideIcon } from "lucide-react";

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  stats?: { label: string; value: string | number }[];
  status?: "active" | "coming-soon" | "beta";
}

export function ModuleCard({ title, description, href, icon: Icon, stats, status = "active" }: ModuleCardProps) {
  const isDisabled = status === "coming-soon";

  const content = (
    <Card className={`group transition-all duration-200 ${
      isDisabled 
        ? "opacity-60 cursor-not-allowed" 
        : "hover:shadow-lg hover:border-primary/50 cursor-pointer"
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {status === "coming-soon" && (
                  <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
                )}
                {status === "beta" && (
                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Beta</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {!isDisabled && (
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
      </CardHeader>
      {stats && stats.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex gap-4 text-sm">
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="font-semibold">{stat.value}</span>
                <span className="text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );

  if (isDisabled) {
    return content;
  }

  return <Link to={href}>{content}</Link>;
}
