import { useState, useEffect, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { useHealthData } from "../../hooks/useHealthData";
import { useIdleTimer } from "../../hooks/useIdleTimer";
import NeighborhoodMode from "../neighborhood/NeighborhoodMode";
import IdleShowcase from "../showcase/IdleShowcase";
import AboutDrawer from "../shared/AboutDrawer";
import TourOverlay from "../shared/TourOverlay";
import ErrorBoundary from "../shared/ErrorBoundary";

const TOUR_SEEN_KEY = "aph_tour_seen_v1";

const ExploreMode = lazy(() => import("../explore/ExploreMode"));
const CompareMode = lazy(() => import("../compare/CompareMode"));

export default function AppShell() {
  const { loading, error } = useHealthData();
  const { isIdle } = useIdleTimer();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Each idle period ends a kiosk "visit": remount the views so the next
  // visitor never sees the previous visitor's ZIP, age, or calculator inputs.
  const [visit, setVisit] = useState(0);
  const [wasIdle, setWasIdle] = useState(false);
  if (isIdle !== wasIdle) {
    setWasIdle(isIdle);
    if (isIdle) setVisit((v) => v + 1);
  }
  useEffect(() => {
    // Also drop any ZIP carried in the URL (e.g. #/explore?zcta=78741).
    if (isIdle) navigate("/", { replace: true });
  }, [isIdle, navigate]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY) === "1";
    } catch {
      // localStorage may be blocked — fall back to "seen" so we don't auto-pop
      return true;
    }
  });

  const openTour = () => setTourOpen(true);
  const closeTour = () => {
    setTourOpen(false);
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setHasSeenTour(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink font-semibold">
            Loading health data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-page">
        <div className="text-center max-w-md p-8">
          <span className="material-symbols-outlined text-negative text-5xl mb-4 block">
            error
          </span>
          <h2 className="text-xl font-semibold text-ink mb-2">
            Unable to Load Data
          </h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Header onInfoClick={() => setAboutOpen(true)} />
      <main className="flex-1">
        <ErrorBoundary key={`${pathname}:${visit}`}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-ink font-semibold">Loading...</p>
                </div>
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <NeighborhoodMode onAboutClick={() => setAboutOpen(true)} />
                }
              />
              <Route path="/explore" element={<ExploreMode />} />
              <Route path="/compare" element={<CompareMode />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />

      {/* Floating tour button — icon-only on mobile, labeled pill on desktop */}
      <button
        onClick={openTour}
        className={`fixed right-4 sm:right-5 group flex items-center justify-center gap-2 sm:pl-3 sm:pr-4 py-2.5 rounded-full bg-primary text-on-brand shadow-lg hover:brightness-110 active:scale-[0.97] transition w-12 h-12 sm:w-auto sm:h-auto ${
          !hasSeenTour ? "ring-4 ring-primary/30" : ""
        }`}
        aria-label="Take a 60-second tour"
        title="Take a 60-second tour"
        style={{
          zIndex: 1500,
          bottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <span className="material-symbols-outlined text-xl">tour</span>
        <span className="hidden sm:inline text-sm font-semibold">
          60-second tour
        </span>
      </button>

      <AboutDrawer isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
      {tourOpen && <TourOverlay onClose={closeTour} />}
      {isIdle && <IdleShowcase onDismiss={() => {}} />}
    </div>
  );
}
