import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransportCard } from "./TransportCard";
import { CapacityTable } from "./CapacityTable";
import { useTransport } from "@/context/TransportContext";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TransportOverview() {
  const { bakwagens, aanhangers, combis } = useTransport();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex justify-end gap-2">
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
    </div>
  );
}
