import { Route, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRouteSuggestions, RouteSuggestion } from '@/hooks/useRouteSuggestions';

interface RouteSuggestionBannerProps {
  orderStartDate?: string;
  orderEndDate?: string;
  excludeOrderId?: string;
}

export function RouteSuggestionBanner({
  orderStartDate,
  orderEndDate,
  excludeOrderId,
}: RouteSuggestionBannerProps) {
  const { data: suggestions = [] } = useRouteSuggestions({
    orderStartDate,
    orderEndDate,
    excludeOrderId,
  });

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
            Combinatie-suggesties
          </h3>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Er rijden al chauffeurs op dezelfde dag(en). Overweeg om ritten te combineren:
        </p>
        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => (
            <SuggestionRow key={idx} suggestion={suggestion} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionRow({ suggestion }: { suggestion: RouteSuggestion }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{suggestion.driverName}</span>
        <span className="text-muted-foreground ml-1">
          rijdt al{' '}
          {suggestion.existingOrderNumbers.map((num, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 mx-0.5 inline-flex">
                {num}
              </Badge>
            </span>
          ))}
        </span>
      </div>
      <Badge variant="secondary" className="text-[10px] shrink-0">
        <Route className="h-3 w-3 mr-1" />
        {suggestion.routeDate}
      </Badge>
    </div>
  );
}
