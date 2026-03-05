import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full border bg-background px-1 py-1 text-xs">
      <Button
        type="button"
        size="sm"
        variant={language === "de" ? "default" : "ghost"}
        className="h-7 px-3 text-xs"
        onClick={() => setLanguage("de")}
      >
        {t("lang.de")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-7 px-3 text-xs"
        onClick={() => setLanguage("en")}
      >
        {t("lang.en")}
      </Button>
    </div>
  );
}

