// src/store/slices/helpCenterSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { HelpCenterState, HelpServiceType, HelpServiceExtended, GeolocationCoordinatesSnapshot } from "@/types/extensions";

const initialState: HelpCenterState = {
  userLocation: null,
  locationPermission: "unknown",
  selectedService: null,
  activeSearchRadius: 30,
  activeFilter: "all",
  mapView: false,
};

const helpCenterSlice = createSlice({
  name: "helpCenter",
  initialState,
  reducers: {
    setUserLocation(state, action: PayloadAction<GeolocationCoordinatesSnapshot>) {
      state.userLocation = action.payload;
      state.locationPermission = "granted";
    },
    setLocationPermission(
      state,
      action: PayloadAction<"granted" | "denied" | "prompt" | "unknown">
    ) {
      state.locationPermission = action.payload;
    },
    setSelectedService(state, action: PayloadAction<HelpServiceExtended | null>) {
      state.selectedService = action.payload;
    },
    setSearchRadius(state, action: PayloadAction<number>) {
      state.activeSearchRadius = action.payload;
    },
    setFilter(state, action: PayloadAction<HelpServiceType | "all">) {
      state.activeFilter = action.payload;
    },
    toggleMapView(state) {
      state.mapView = !state.mapView;
    },
  },
});

export const {
  setUserLocation,
  setLocationPermission,
  setSelectedService,
  setSearchRadius,
  setFilter,
  toggleMapView,
} = helpCenterSlice.actions;

export default helpCenterSlice.reducer;
