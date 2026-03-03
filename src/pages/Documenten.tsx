import { FileText, HardHat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Documenten = () => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <HardHat className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold">In aanbouw</h2>
          <p className="mb-4 text-muted-foreground">
            We werken hard aan de documentenmodule. Hier kun je straks
            documenten beheren, delen en snel terugvinden.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Binnenkort beschikbaar</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Documenten;
