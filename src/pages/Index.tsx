import { 
  Truck, 
  CalendarDays, 
  Users, 
  Bike,
  MapPin,
  Wrench,
  BarChart3,
  FileText,
  Settings,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransport } from "@/context/TransportContext";
import { useOrders } from "@/context/OrdersContext";

const Index = () => {
  const navigate = useNavigate();
  const { bakwagens, aanhangers, combis, drivers, isLoading } = useTransport();
  const { getPlanningOrders } = useOrders();
  
  const planningOrders = getPlanningOrders();
  const todayDate = new Date().toISOString().split('T')[0];
  const todayDeliveries = planningOrders.filter(o => o.logisticDeliveryDate === todayDate || o.logisticPickupDate === todayDate);
  const pendingDeliveries = planningOrders.filter(o => 
    o.segments.some(s => s.status === 'pending')
  );

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer transition-all hover:shadow-md hover:bg-primary/5"
          onClick={() => navigate('/planning')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leveringen vandaag</p>
                <p className="text-3xl font-bold">{todayDeliveries.length}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer transition-all hover:shadow-md hover:bg-orange-50"
          onClick={() => navigate('/orders?filter=unassigned')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nog toewijzen</p>
                <p className="text-3xl font-bold text-orange-600">{pendingDeliveries.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transportmiddelen</p>
                <p className="text-3xl font-bold">{bakwagens.length + aanhangers.length}</p>
              </div>
              <Truck className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chauffeurs</p>
                <p className="text-3xl font-bold">{drivers.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            title="Planning"
            description="Bekijk en beheer leveringen per dag"
            href="/planning"
            icon={CalendarDays}
            stats={[
              { label: "vandaag", value: todayDeliveries.length },
              { label: "openstaand", value: pendingDeliveries.length },
            ]}
          />
          <ModuleCard
            title="Transportmateriaal"
            description="Bakwagens, aanhangers en combi's"
            href="/transport"
            icon={Truck}
            stats={[
              { label: "bakwagens", value: bakwagens.length },
              { label: "aanhangers", value: aanhangers.length },
              { label: "combi's", value: combis.length },
            ]}
          />
          <ModuleCard
            title="Voertuigen"
            description="E-bikes, fatbikes, choppers & meer"
            href="/voertuigen"
            icon={Bike}
            status="coming-soon"
          />
          <ModuleCard
            title="Chauffeurs"
            description="Beheer chauffeurs en beschikbaarheid"
            href="/chauffeurs"
            icon={Users}
            stats={[{ label: "actief", value: drivers.length }]}
            status="coming-soon"
          />
          <ModuleCard
            title="Locaties"
            description="Ophaal- en afleverlocaties"
            href="/locaties"
            icon={MapPin}
            status="coming-soon"
          />
          <ModuleCard
            title="Onderhoud"
            description="Onderhoudsplanning en historie"
            href="/onderhoud"
            icon={Wrench}
            status="coming-soon"
          />
          <ModuleCard
            title="Rapportages"
            description="Statistieken en overzichten"
            href="/rapportages"
            icon={BarChart3}
            status="coming-soon"
          />
          <ModuleCard
            title="Documenten"
            description="Contracten en documentatie"
            href="/documenten"
            icon={FileText}
            status="coming-soon"
          />
          <ModuleCard
            title="Instellingen"
            description="Systeeminstellingen"
            href="/instellingen"
            icon={Settings}
            status="coming-soon"
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
