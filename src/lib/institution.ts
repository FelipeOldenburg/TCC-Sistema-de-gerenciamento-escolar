import { useLayoutEffect, useState } from "react";
import cimolLogo from "@/assets/cimol-logo.png";
import { apiFetch, INSTITUTION_DOMAIN, selectedInstitutionSlug } from "@/lib/api";

export type InstitutionBrand = {
  slug: string;
  name: string;
  adminName: string;
  systemName: string;
  adminSubtitle: string;
  logo: string | null;
  colors: {
    primary: string;
    accent: string;
    header: string;
    nav: string;
    navActive: string;
  };
};

export type InstitutionResponse = Omit<InstitutionBrand, "logo"> & {
  logoUrl: string | null;
};

export const institutionBrand: InstitutionBrand = {
  slug: "cimol",
  name: "CIMOL",
  adminName: "CIMOL Admin",
  systemName: "Sistema de Gestão Escolar",
  adminSubtitle: "Painel Administrativo",
  logo: cimolLogo,
  colors: {
    primary: "228 65% 48%",
    accent: "45 100% 51%",
    header: "228 62% 32%",
    nav: "228 62% 42%",
    navActive: "228 50% 52%",
  },
};

let cachedBrand = institutionBrand;
let pendingBrand: { slug: string; promise: Promise<InstitutionBrand> } | null = null;

const loadingBrand: InstitutionBrand = {
  slug: "",
  name: "Carregando instituição...",
  adminName: "Carregando instituição...",
  systemName: "",
  adminSubtitle: "",
  logo: null,
  colors: {
    primary: "220 12% 40%",
    accent: "220 12% 75%",
    header: "220 12% 30%",
    nav: "220 12% 40%",
    navActive: "220 12% 50%",
  },
};

const setThemeColor = (name: string, value: string) => {
  if (!/^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/.test(value)) return;
  document.documentElement.style.setProperty(name, value);
};

const applyInstitutionTheme = (brand: InstitutionBrand) => {
  document.title = brand.name || "CIMOL";
  setThemeColor("--primary", brand.colors.primary);
  setThemeColor("--ring", brand.colors.primary);
  setThemeColor("--accent", brand.colors.accent);
  setThemeColor("--header-bg", brand.colors.header);
  setThemeColor("--nav-bg", brand.colors.nav);
  setThemeColor("--nav-active", brand.colors.navActive);
};

const applyInstitutionMetadata = (brand: InstitutionBrand) => {
  const title = `Horários do ${brand.name} | Horário da Escola`;
  const description = `Consulte horários de aula, turmas, eventos e informações de ${brand.name} no Horário da Escola.`;
  const canonical = `https://${brand.slug}.${INSTITUTION_DOMAIN}/`;
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
};

const toInstitutionBrand = (data: InstitutionResponse): InstitutionBrand => ({
  ...data,
  logo: data.logoUrl || (data.slug === "cimol" ? cimolLogo : null),
});

export const setInstitutionBrand = (data: InstitutionResponse) => {
  cachedBrand = toInstitutionBrand(data);
  applyInstitutionTheme(cachedBrand);
  applyInstitutionMetadata(cachedBrand);
  return cachedBrand;
};

const loadInstitutionBrand = (slug: string) => {
  if (pendingBrand?.slug === slug) return pendingBrand.promise;
  const promise = apiFetch<InstitutionResponse>("/api/instituicao").then((data) => {
    return selectedInstitutionSlug() === slug ? setInstitutionBrand(data) : toInstitutionBrand(data);
  }).catch((error) => {
    if (pendingBrand?.slug === slug) pendingBrand = null;
    throw error;
  });
  pendingBrand = { slug, promise };
  return promise;
};

export const useInstitutionBrand = () => {
  const selectedSlug = selectedInstitutionSlug();
  const [brand, setBrand] = useState(cachedBrand);
  const waitingForBrand = Boolean(selectedSlug && brand.slug !== selectedSlug);

  useLayoutEffect(() => {
    let active = true;
    if (selectedSlug && cachedBrand.slug !== selectedSlug) applyInstitutionTheme(loadingBrand);
    loadInstitutionBrand(selectedSlug)
      .then((loadedBrand) => {
        if (active) setBrand(loadedBrand);
      })
      .catch(() => {
        if (active && selectedSlug) {
          const unavailableBrand = { ...loadingBrand, slug: selectedSlug, name: "Instituição indisponível" };
          applyInstitutionTheme(unavailableBrand);
          setBrand(unavailableBrand);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedSlug]);

  return waitingForBrand ? loadingBrand : brand;
};
