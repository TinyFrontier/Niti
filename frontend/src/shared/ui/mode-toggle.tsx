import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { useTheme, type Theme } from "@/app/theme-provider";

const options: Array<{ value: Theme; label: string; icon: typeof SunIcon }> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: DesktopIcon },
];

export function ModeToggle({ inverted = false }: { inverted?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant={inverted ? "ghost" : "secondary"}
          size="sm"
          shape="square"
          icon={<ActiveIcon />}
          aria-label="Change color theme"
          className={inverted ? "text-kumo-subtle hover:text-kumo-default" : undefined}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenu.Item
            key={value}
            icon={<Icon />}
            selected={theme === value}
            onClick={() => setTheme(value)}
          >
            {label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
