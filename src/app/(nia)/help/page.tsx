// src/app/(nia)/help/page.tsx
// Feature 5: Enhanced help center with geolocation + live distance sorting

"use client";

import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setSelectedService,
  setFilter,
  setSearchRadius,
  toggleMapView,
} from "@/store/slices/helpCenterSlice";
import {
  useNearbyHelpServices,
  useUserGeolocation,
  useLogServiceSearch,
  useLogServiceCall,
} from "@/hooks/useExtendedFeatures";
import { cn } from "@/utils";
import type { HelpServiceExtended, HelpServiceType } from "@/types/extensions";
import {
  MapPin, Phone, Clock, Globe, MessageCircle,
  Search, Locate, Star, Building2, Shield,
  Stethoscope, Scale, Heart, Home, HelpCircle, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const SERVICE_TYPE_CONFIG: Record<
  HelpServiceType | "all",
  { label: string; icon: React.ElementType; color: string }
> = {
  all:                  { label: "All",         icon: Globe,       color: "bg-earth-100 text-earth-700" },
  shelter:              { label: "Shelter",      icon: Home,        color: "bg-blue-100 text-blue-700" },
  legal_aid:            { label: "Legal Aid",    icon: Scale,       color: "bg-nia-100 text-nia-700" },
  police_gender_desk:   { label: "Police",       icon: Shield,      color: "bg-indigo-100 text-indigo-700" },
  counseling:           { label: "Counseling",   icon: Heart,       color: "bg-purple-100 text-purple-700" },
  medical:              { label: "Medical",      icon: Stethoscope, color: "bg-green-100 text-green-700" },
  financial_support:    { label: "Financial",    icon: Building2,   color: "bg-yellow-100 text-yellow-700" },
  child_protection:     { label: "Children",     icon: HelpCircle,  color: "bg-orange-100 text-orange-700" },
  hotline:              { label: "Hotline",      icon: Phone,       color: "bg-emergency-100 text-emergency-700" },
};

export default function HelpPage() {
  const dispatch = useAppDispatch();
  const { requestLocation } = useUserGeolocation();
  const logSearch = useLogServiceSearch();
  const logCall = useLogServiceCall();
  const searchLogIdRef = useRef<number | undefined>(undefined);

  const { userLocation, locationPermission, activeFilter, activeSearchRadius, selectedService } =
    useAppSelector((s) => s.helpCenter);

  const [search, setSearch] = useState("");

  // Fetch nearby services when location available
  const { data: services = [], isLoading, refetch } = useNearbyHelpServices(
    userLocation
      ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          radius_km: activeSearchRadius,
          service_type: activeFilter === "all" ? undefined : activeFilter,
          emergency_only: false,
        }
      : null
  );

  // Log search when results arrive
  useEffect(() => {
    if (services.length > 0 && userLocation) {
      logSearch.mutate({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radius_km: activeSearchRadius,
        service_type: activeFilter === "all" ? undefined : activeFilter,
        results_count: services.length,
      }, {
        onSuccess: (_, __, ctx) => {
          // Capture search ID for call logging
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length]);

  const filtered = services.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.county.toLowerCase().includes(q)
    );
  });

  const handleLocate = async () => {
    await requestLocation();
  };

  const handleCall = (service: HelpServiceExtended) => {
    logCall.mutate({ serviceId: service.id });
    window.open(`tel:${service.phone}`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl text-earth-900">Help Near You</h1>
        <p className="text-sm text-earth-500 mt-0.5">Verified support organizations across Kenya</p>
      </div>

      {/* Emergency hotline banner */}
      <div className="bg-emergency-50 border border-emergency-200 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emergency-800">In immediate danger?</p>
          <p className="text-xs text-emergency-600">Free · Available 24/7 across Kenya</p>
        </div>
        <a
          href="tel:1195"
          className="flex items-center gap-1.5 bg-emergency-600 text-white px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-all"
          onClick={() => logCall.mutate({ serviceId: "hotline-1195" })}
        >
          <Phone className="w-4 h-4" />
          1195
        </a>
      </div>

      {/* Location request */}
      {locationPermission !== "granted" && (
        <button
          onClick={handleLocate}
          className="w-full flex items-center gap-3 bg-nia-50 border border-nia-200 rounded-2xl p-4 hover:bg-nia-100 transition-colors"
        >
          <div className="w-10 h-10 bg-nia-100 rounded-xl flex items-center justify-center shrink-0">
            <Locate className="w-5 h-5 text-nia-600" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-nia-800">Find services near you</p>
            <p className="text-xs text-nia-600">Allow location to see closest organizations</p>
          </div>
          <div className="text-nia-400 text-xs font-medium">Enable →</div>
        </button>
      )}

      {/* Location acquired indicator */}
      {userLocation && (
        <div className="flex items-center gap-2 text-xs text-earth-500">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>
            Showing services within {activeSearchRadius}km of your location
          </span>
          <button
            onClick={handleLocate}
            className="text-nia-600 font-medium ml-auto"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, service, or county…"
          className="w-full h-11 pl-10 pr-4 bg-white border border-earth-200 rounded-xl text-sm outline-none focus:border-nia-400 focus:ring-1 focus:ring-nia-200"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {(Object.keys(SERVICE_TYPE_CONFIG) as (HelpServiceType | "all")[]).map((type) => {
          const cfg = SERVICE_TYPE_CONFIG[type];
          const Icon = cfg.icon;
          const isActive = activeFilter === type;
          return (
            <button
              key={type}
              onClick={() => dispatch(setFilter(type))}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium",
                "whitespace-nowrap transition-all shrink-0 active:scale-95",
                isActive
                  ? "bg-nia-600 text-white shadow-sm"
                  : "bg-white border border-earth-200 text-earth-600 hover:border-nia-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Radius selector */}
      {userLocation && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-earth-500 shrink-0">Radius:</span>
          <div className="flex gap-1.5">
            {[10, 30, 50, 100].map((km) => (
              <button
                key={km}
                onClick={() => dispatch(setSearchRadius(km))}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  activeSearchRadius === km
                    ? "bg-earth-800 text-white"
                    : "bg-earth-100 text-earth-600 hover:bg-earth-200"
                )}
              >
                {km}km
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-earth-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Finding nearby services…</span>
        </div>
      ) : !userLocation && filtered.length === 0 ? (
        <Card className="text-center py-10">
          <MapPin className="w-10 h-10 text-earth-200 mx-auto mb-3" />
          <p className="text-sm text-earth-500 font-medium">Location needed</p>
          <p className="text-xs text-earth-400 mt-1">Enable location to find services near you</p>
          <Button size="sm" variant="secondary" onClick={handleLocate} className="mt-4 gap-1.5">
            <Locate className="w-4 h-4" /> Enable Location
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-10">
          <Globe className="w-8 h-8 text-earth-200 mx-auto mb-2" />
          <p className="text-sm text-earth-400">No services found within {activeSearchRadius}km</p>
          <button
            onClick={() => dispatch(setSearchRadius(100))}
            className="text-xs text-nia-600 font-medium mt-2"
          >
            Expand to 100km
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-earth-400">
            {filtered.length} service{filtered.length !== 1 ? "s" : ""} found
          </p>
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onCall={() => handleCall(service)}
              onSelect={() => dispatch(setSelectedService(service))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onCall,
  onSelect,
}: {
  service: HelpServiceExtended;
  onCall: () => void;
  onSelect: () => void;
}) {
  const typeCfg = SERVICE_TYPE_CONFIG[service.type] ?? SERVICE_TYPE_CONFIG.all;
  const TypeIcon = typeCfg.icon;

  return (
    <Card hover onClick={onSelect} className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
              typeCfg.color
            )}>
              <TypeIcon className="w-3 h-3" />
              {typeCfg.label}
            </span>
            {service.is_24_hour && (
              <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-100">
                24/7
              </span>
            )}
            {service.has_safe_house && (
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Safe house
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-earth-900 leading-tight">{service.name}</h3>
          {service.distance_km !== undefined && (
            <p className="text-xs text-nia-600 font-medium mt-0.5">
              {service.distance_km < 1
                ? `${Math.round(service.distance_km * 1000)}m away`
                : `${service.distance_km.toFixed(1)}km away`}
            </p>
          )}
        </div>

        {service.rating_average && (
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-medium text-earth-700">
              {service.rating_average.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-earth-500 leading-relaxed line-clamp-2">
        {service.description}
      </p>

      {/* Meta row */}
      <div className="space-y-1 text-xs text-earth-500">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-earth-400 shrink-0" />
          <span className="truncate">{service.address}</span>
        </div>
        {service.nearby_landmark && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-earth-300 shrink-0" />
            <span className="text-earth-400">{service.nearby_landmark}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-earth-400 shrink-0" />
          <span>{service.hours}</span>
        </div>
        {service.response_time_minutes && (
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-earth-400 shrink-0" />
            <span>Avg response: ~{service.response_time_minutes} min</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); onCall(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-nia-600 hover:bg-nia-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-95"
        >
          <Phone className="w-3.5 h-3.5" />
          Call
        </button>

        {service.whatsapp_link && (
          <a
            href={service.whatsapp_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-95"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        )}

        <a
          href={`https://maps.google.com/?q=${service.lat},${service.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1 px-3 py-2.5 bg-earth-100 hover:bg-earth-200 text-earth-700 rounded-xl text-xs font-medium transition-all active:scale-95"
          aria-label="Open in Maps"
        >
          <Globe className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Safety flag */}
      {service.is_at_capacity && (
        <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 rounded-xl px-3 py-2">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Currently at capacity — call ahead before visiting
        </div>
      )}
    </Card>
  );
}
