import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransportMaterial, CombiTransport, vehicleTypes } from "@/data/transportData";
import { Truck, Caravan, Link2 } from "lucide-react";

interface TransportCardProps {
  transport: TransportMaterial | CombiTransport;
  isCombi?: boolean;
}

export function TransportCard({ transport, isCombi = false }: TransportCardProps) {
  const getIcon = () => {
    if (isCombi) return <Link2 className="h-5 w-5" />;
    if ((transport as TransportMaterial).type === 'bakwagen') return <Truck className="h-5 w-5" />;
    return <Caravan className="h-5 w-5" />;
  };

  const getTypeLabel = () => {
    if (isCombi) return 'Combi';
    return (transport as TransportMaterial).type === 'bakwagen' ? 'Bakwagen' : 'Aanhanger';
  };

  const getTypeBadgeVariant = () => {
    if (isCombi) return 'default';
    return (transport as TransportMaterial).type === 'bakwagen' ? 'secondary' : 'outline';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            <CardTitle className="text-lg">{transport.name}</CardTitle>
          </div>
          <Badge variant={getTypeBadgeVariant()}>
            {getTypeLabel()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {vehicleTypes.map((vehicle) => (
            <div 
              key={vehicle.id} 
              className="flex items-center justify-between p-2 rounded-lg bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{vehicle.icon}</span>
                <span className="text-sm text-muted-foreground">{vehicle.name}</span>
              </div>
              <span className="font-bold text-lg">
                {transport.capacity[vehicle.id]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
