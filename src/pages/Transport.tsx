import { TransportOverview } from "@/components/logistics/TransportOverview";
import { TransportAvailability } from "@/components/logistics/TransportAvailability";
import { CapacityCalculator } from "@/components/logistics/CapacityCalculator";
import { Card, CardContent } from "@/components/ui/card";
import { vehicleTypes } from "@/data/transportData";
import { useTransport } from "@/context/TransportContext";
import { Truck, Caravan, Link2, Bike } from "lucide-react";

const Transport = () => {
  const { bakwagens, aanhangers, combis, isLoading } = useTransport();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Transport laden...</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bakwagens.length}</p>
                <p className="text-sm text-muted-foreground">Bakwagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Caravan className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aanhangers.length}</p>
                <p className="text-sm text-muted-foreground">Aanhangers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Link2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{combis.length}</p>
                <p className="text-sm text-muted-foreground">Combi's</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Bike className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{vehicleTypes.length}</p>
                <p className="text-sm text-muted-foreground">Voertuigtypes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transport Availability Timeline */}
      <TransportAvailability />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransportOverview />
        </div>
        <div>
          <CapacityCalculator />
        </div>
      </div>
    </div>
  );
};

export default Transport;
