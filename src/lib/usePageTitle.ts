import { useEffect } from "react";
import { SITE } from "./site";

const TITLES: Record<string, string> = {
  Home: `${SITE.name} — Property management for small portfolios in SE Wisconsin`,
};

export function usePageTitle(name: string) {
  useEffect(() => {
    document.title = TITLES[name] ?? `${name} — ${SITE.name}`;
  }, [name]);
}
