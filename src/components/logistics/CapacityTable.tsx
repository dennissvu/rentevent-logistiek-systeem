import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  vehicleTypes,
  TransportMaterial,
  CombiTransport 
} from "@/data/transportData";
import { useTransport } from "@/context/TransportContext";
import { Truck, Caravan, Link2 } from "lucide-react";

export function CapacityTable() {
  const { allTransportMaterials, combis } = useTransport();

  const getIcon = (item: TransportMaterial | CombiTransport, isCombi: boolean) => {
    if (isCombi) return <Link2 className="h-4 w-4 text-primary" />;
    if ((item as TransportMaterial).type === 'bakwagen') return <Truck className="h-4 w-4 text-primary" />;
    return <Caravan className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Transportmiddel</TableHead>
            {vehicleTypes.map((vehicle) => (
              <TableHead key={vehicle.id} className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>{vehicle.icon}</span>
                  <span className="hidden sm:inline">{vehicle.name}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Individuele transportmiddelen */}
          {allTransportMaterials.map((transport) => (
            <TableRow key={transport.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getIcon(transport, false)}
                  <span className="font-medium">{transport.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {transport.type === 'bakwagen' ? 'Bak' : 'Anh'}
                  </Badge>
                </div>
              </TableCell>
              {vehicleTypes.map((vehicle) => (
                <TableCell key={vehicle.id} className="text-center font-semibold">
                  {transport.capacity[vehicle.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
          
          {/* Separator row */}
          <TableRow>
            <TableCell colSpan={6} className="bg-muted/50 py-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Combinaties
              </span>
            </TableCell>
          </TableRow>

          {/* Combi's */}
          {combis.map((combi) => (
            <TableRow key={combi.id} className="bg-accent/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  {getIcon(combi, true)}
                  <span className="font-medium">{combi.name}</span>
                  <Badge variant="default" className="ml-2 text-xs">
                    Combi
                  </Badge>
                </div>
              </TableCell>
              {vehicleTypes.map((vehicle) => (
                <TableCell key={vehicle.id} className="text-center font-bold text-primary">
                  {combi.capacity[vehicle.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
