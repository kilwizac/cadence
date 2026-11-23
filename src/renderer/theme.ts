import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
  headings: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif', fontWeight: "700" },
  fontSizes: { xs: "11px", sm: "13px", md: "14px", lg: "16px", xl: "20px" },
  components: {
    Button: { defaultProps: { size: "sm" } },
    TextInput: { defaultProps: { size: "sm" } },
    Textarea: { defaultProps: { size: "sm" } },
    Select: { defaultProps: { size: "sm", allowDeselect: false } },
    Badge: { defaultProps: { variant: "light", radius: "sm" } },
    Tooltip: { defaultProps: { openDelay: 400 } },
  },
});
