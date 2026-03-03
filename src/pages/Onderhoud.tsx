import { Wrench, HardHat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Onderhoud = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <HardHat className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">In aanbouw</h2>
          <p className="text-muted-foreground mb-4">
            We werken hard aan de onderhoudsmodule. Hier kun je straks
            onderhoud inplannen, bijhouden en de historie raadplegen van al je
            materiaal.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Wrench className="h-4 w-4" />
            <span>Binnenkort beschikbaar</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onderhoud;
