import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransportCard } from "./TransportCard";
import { CapacityTable } from "./CapacityTable";
import { useTransport } from "@/context/TransportContext";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicleTypes, type TransportType, type VehicleType } from "@/data/transportData";

export function TransportOverview() {
  const { bakwagens, aanhangers, combis, addMaterial } = useTransport();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<TransportType>("bakwagen");
  const [capacity, setCapacity] = useState<Record<VehicleType, number>>({
    "e-choppers": 0,
    "e-fatbikes": 0,
    "fietsen": 0,
    "e-bikes": 0,
    "tweepers": 0,
  });

  const usedCodes = useMemo(
    () => new Set([...bakwagens, ...aanhangers].map(t => t.id.toLowerCase())),
    [bakwagens, aanhangers]
  );

  const normalizedCode = code.trim().toLowerCase();
  const codeExists = normalizedCode.length > 0 && usedCodes.has(normalizedCode);

  const resetAddForm = () => {
    setCode("");
    setName("");
    setType("bakwagen");
    setCapacity({
      "e-choppers": 0,
      "e-fatbikes": 0,
      "fietsen": 0,
      "e-bikes": 0,
      "tweepers": 0,
    });
  };

  const handleAddMaterial = () => {
    if (!normalizedCode || !name.trim() || codeExists) return;
    addMaterial({
      code: normalizedCode,
      name: name.trim(),
      type,
      capacity,
    });
    setIsAddDialogOpen(false);
    resetAddForm();
  };

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          Transportmateriaal toevoegen
        </Button>
        <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('cards')}
        >
          <LayoutGrid className="h-4 w-4 mr-2" />
          Kaarten
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
        >
          <TableIcon className="h-4 w-4 mr-2" />
          Tabel
        </Button>
      </div>

      {viewMode === 'table' ? (
        <CapacityTable />
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="all">Alles</TabsTrigger>
            <TabsTrigger value="bakwagens">Bakwagens</TabsTrigger>
            <TabsTrigger value="aanhangers">Aanhangers</TabsTrigger>
            <TabsTrigger value="combis">Combi's</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {/* Bakwagens */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Bakwagens</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bakwagens.map((transport) => (
                  <TransportCard key={transport.id} transport={transport} />
                ))}
              </div>
            </section>

            {/* Aanhangers */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Aanhangers</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {aanhangers.map((transport) => (
                  <TransportCard key={transport.id} transport={transport} />
                ))}
              </div>
            </section>

            {/* Combi's */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Combinaties</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {combis.map((combi) => (
                  <TransportCard key={combi.id} transport={combi} isCombi />
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="bakwagens">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bakwagens.map((transport) => (
                <TransportCard key={transport.id} transport={transport} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="aanhangers">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aanhangers.map((transport) => (
                <TransportCard key={transport.id} transport={transport} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="combis">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {combis.map((combi) => (
                <TransportCard key={combi.id} transport={combi} isCombi />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Transportmateriaal toevoegen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="transport-code">Code *</Label>
                <Input
                  id="transport-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="bijv. bakwagen-nieuw"
                  className={codeExists ? "border-destructive" : ""}
                />
                {codeExists && (
                  <p className="text-sm text-destructive">Deze code bestaat al.</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transport-type">Type *</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as TransportType)}
                >
                  <SelectTrigger id="transport-type">
                    <SelectValue placeholder="Kies type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bakwagen">Bakwagen</SelectItem>
                    <SelectItem value="aanhanger">Aanhanger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transport-name">Naam *</Label>
              <Input
                id="transport-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Bak Jan"
              />
            </div>

            <div className="grid gap-2">
              <Label>Capaciteit per voertuigtype</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {vehicleTypes.map((vehicle) => (
                  <div key={vehicle.id} className="grid gap-1">
                    <Label htmlFor={`capacity-${vehicle.id}`} className="text-sm text-muted-foreground">
                      {vehicle.icon} {vehicle.name}
                    </Label>
                    <Input
                      id={`capacity-${vehicle.id}`}
                      type="number"
                      min={0}
                      value={capacity[vehicle.id]}
                      onChange={(e) => {
                        const value = Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0);
                        setCapacity((prev) => ({ ...prev, [vehicle.id]: value }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleAddMaterial}
              disabled={!normalizedCode || !name.trim() || codeExists}
            >
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
