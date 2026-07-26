import * as React from "react";
import { Select as KumoSelect } from "@cloudflare/kumo/components/select";
import { cn } from "@/shared/lib/utils";

type SelectValue = string | number | readonly string[];

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "value" | "defaultValue"> {
  value?: SelectValue;
  defaultValue?: SelectValue;
  onValueChange?: (value: string) => void;
}

interface OptionData {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

function getOptions(children: React.ReactNode): OptionData[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type !== "option") return [];
    return [{
      value: String(child.props.value ?? ""),
      label: child.props.children,
      disabled: child.props.disabled,
    }];
  });
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      value,
      defaultValue,
      onChange,
      onValueChange,
      onBlur,
      name,
      disabled,
      required,
      className,
      id,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    forwardedRef,
  ) => {
    const options = React.useMemo(() => getOptions(children), [children]);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
      String(defaultValue ?? options[0]?.value ?? ""),
    );
    const currentValue = String(value ?? uncontrolledValue);

    const handleValueChange = (nextValue: unknown) => {
      const next = String(nextValue ?? "");
      if (value === undefined) setUncontrolledValue(next);
      onValueChange?.(next);

      if (onChange) {
        const target = { value: next, name } as EventTarget & HTMLSelectElement;
        onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
      }
    };

    return (
      // Kumo sizes the trigger to its content (w-max), so a select next to an
      // Input came out visibly narrower. Stretching it to the wrapper makes the
      // two behave the same and lets callers size a field in one place.
      <div className={cn("[&_button]:w-full", className)}>
        <KumoSelect
          value={currentValue}
          onValueChange={handleValueChange}
          disabled={disabled}
          required={required}
          // without renderValue Kumo shows the raw value instead of the option label
          renderValue={(selected) =>
            options.find((option) => option.value === String(selected ?? ""))?.label ?? null
          }
          placeholder={options.find((option) => option.value === "")?.label as string | undefined}
          aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : props.title ?? name ?? "Select option")}
        >
          {options.map((option) => (
            <KumoSelect.Option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </KumoSelect.Option>
          ))}
        </KumoSelect>

        <select
          ref={forwardedRef}
          id={id}
          name={name}
          value={currentValue}
          onChange={() => undefined}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
Select.displayName = "Select";
