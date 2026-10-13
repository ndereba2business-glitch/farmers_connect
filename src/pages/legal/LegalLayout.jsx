import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BrandMark from "../../components/BrandMark";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../config/legal";
import { POLICIES_PUBLISHED } from "../../config/features";
import "./Legal.css";

// The frame around the public policy pages. They are readable signed in or
// out and read nothing from the database, so they load on any connection
// and can be linked from the Play Store listing.
export default function LegalLayout({ title, updated, children }) {
  const { user } = useAuth();
  const { hash, pathname } = useLocation();

  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
    return () => { document.title = APP_NAME; };
  }, [title]);

  // an address ending in #deletion opens at that section
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash, pathname]);

  return (
    <div className="lg-root">
      <header className="lg-bar">
        <Link to="/" className="lg-brand" aria-label={`${APP_NAME} home`}>
          <BrandMark size={32} title="" />
          <span>{APP_NAME}</span>
        </Link>
        <span className="lg-bar-right">
          <ThemeToggle />
          <Link to="/" className="lg-back">
            <ArrowLeft size={16} aria-hidden="true" /> {user ? "Back to the app" : "Home"}
          </Link>
        </span>
      </header>

      <main className="lg-main">
        <h1>{title}</h1>
        {updated && <p className="lg-updated">Last updated: {updated}</p>}
        {children}
      </main>

      <footer className="lg-foot">
        <nav aria-label="Policies">
          {POLICIES_PUBLISHED && <Link to="/privacy">Privacy Policy</Link>}
          {POLICIES_PUBLISHED && <Link to="/terms">Terms and Community Rules</Link>}
          <Link to="/delete-account">Delete your account</Link>
        </nav>
        <p>© {new Date().getFullYear()} {APP_NAME}</p>
      </footer>
    </div>
  );
}
