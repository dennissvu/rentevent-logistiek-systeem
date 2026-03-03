import { Link } from "react-router-dom";
import { Truck, CalendarDays, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <span className="font-semibold">Rent & Event Logistiek</span>
          </div>
          <Button asChild variant="default">
            <Link to="/login">Inloggen</Link>
          </Button>
        </div>
      </header>

      <main className="container px-4 py-16 md:py-24">
        <section className="mx-auto max-w-3xl space-y-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Logistiek beheer voor verhuur en evenementen
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Plan leveringen, beheer transportmiddelen en chauffeurs, en houd alle
            orders en ritten overzichtelijk op één plek.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="min-w-[160px]">
              <Link to="/login">Inloggen</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <CalendarDays className="mb-2 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Planning</h3>
              <p className="text-sm text-muted-foreground">
                Dag- en weekplanning voor leveringen en ophalen.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Truck className="mb-2 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Transport</h3>
              <p className="text-sm text-muted-foreground">
                Beheer bakwagens, aanhangers en beschikbaarheid.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Package className="mb-2 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Orders</h3>
              <p className="text-sm text-muted-foreground">
                Orders koppelen aan ritten en chauffeurs.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <MapPin className="mb-2 h-8 w-8 text-primary" />
              <h3 className="font-semibold">Routes</h3>
              <p className="text-sm text-muted-foreground">
                Routebouw en optimalisatie per dag.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Landing;
