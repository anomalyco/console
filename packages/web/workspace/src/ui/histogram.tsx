import { For, Show, createMemo, createSignal } from "solid-js";
import { styled } from "@macaron-css/solid";
import { Text } from "./text";
import { theme } from "./theme";
import { utility } from "./utility";
import { Row, Stack } from "./layout";

type HistogramPoint = {
  value: number;
};

type HistogramPointWithHeight = HistogramPoint & {
  height: number;
};

function generateBarHeights(
  maxBarHeight: number,
  data: HistogramPoint[]
): HistogramPointWithHeight[] {
  const values = data.map((d) => d.value);
  const maxValue = Math.max(1, ...values);

  const newData = data.map(({ value }) => {
    const height = (value / maxValue) * maxBarHeight;
    const roundedHeight = Math.max(Math.round(height), 1);

    return { value, height: roundedHeight };
  });

  return newData;
}

const HistogramBar = styled("div", {
  base: {
    background: `linear-gradient(180deg,
      hsl(${theme.color.base.blue}) 0%,
      hsl(${theme.color.blue.l2}) 50%,
      hsl(${theme.color.blue.l4}) 95%,
      hsl(${theme.color.blue.l4}) 100%
    )`,
  },
});

const HistogramTooltip = styled("div", {
  base: {
    ...utility.stack(2),
    zIndex: 1,
    alignItems: "center",
    position: "absolute",
    padding: theme.space[2],
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderRadius: theme.borderRadius,
    boxShadow: theme.color.shadow.drop.short,
    backgroundColor: theme.color.background.popup,
    border: `1px solid ${theme.color.divider.base}`,
  },
});

const HistogramTooltipValue = styled("div", {
  base: {
    ...utility.row(2),
    paddingTop: theme.space[2],
    flex: "1 1 auto",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderTop: `1px solid ${theme.color.divider.surface}`,
  },
});

function getHourMarkers(currentTime: number) {
  const currentDateTime = new Date(currentTime);
  let currentHour = currentDateTime.getHours();

  const hourMarkers = [];

  // Start with the next hour and loop for 24 hours
  for (let i = 1; i <= 24; i++) {
    currentHour = (currentHour + 1) % 24;

    let period = "AM";
    let displayHour = currentHour;

    // Convert to 12-hour format and identify AM or PM
    if (currentHour >= 12) {
      if (currentHour > 12) {
        displayHour = currentHour - 12;
      }
      period = "PM";
    } else if (currentHour === 0) {
      displayHour = 12;
    }

    let nextDisplayHour = displayHour + 1;

    const marker = `${displayHour}:00 ${period} — ${nextDisplayHour - 1
      }:59 ${period}`;
    hourMarkers.push(marker);
  }

  return hourMarkers;
}

const HistogramRoot = styled("div", {
  base: {
    ...utility.row("px"),
    zIndex: 2,
    position: "relative",
  },
});

interface HistogramProps {
  width: number;
  height: number;
  units: string;
  currentTime: number;
  data: HistogramPoint[];
  tooltipAlignment?: "top" | "bottom";
}

export function Histogram(props: HistogramProps) {
  const tooltipWidth = 135;
  const barWidth = (props.width - props.data.length + 1) / props.data.length;
  const [showTooltip, setShowTooltip] = createSignal<number>();

  const barData = createMemo(() =>
    generateBarHeights(props.height, props.data)
  );
  const hourMarkers = createMemo(() => getHourMarkers(props.currentTime));
  const tooltipLeft = createMemo(() => {
    const tooltip = showTooltip();

    if (tooltip === undefined) {
      return null;
    }

    const initialLeft = (tooltip + 1) * barWidth;

    return initialLeft + tooltipWidth > props.width
      ? initialLeft + barWidth - tooltipWidth
      : initialLeft;
  });

  window.addEventListener("blur", () => setShowTooltip(undefined));

  return (
    <HistogramRoot>
      <For each={barData()}>
        {(bar, i) => (
          <Stack
            vertical="end"
            style={{ height: `${props.height}px` }}
            onMouseEnter={() => setShowTooltip(i)}
            onMouseLeave={() => setShowTooltip(undefined)}
          >
            <HistogramBar
              style={{
                width: `${barWidth}px`,
                height: `${bar.height}px`,
              }}
            />
          </Stack>
        )}
      </For>
      <Show when={showTooltip() !== undefined}>
        <HistogramTooltip
          style={{
            width: `${tooltipWidth}px`,
            left: `${tooltipLeft()}px`,
            top:
              props.tooltipAlignment === "top"
                ? "-67px"
                : `${props.height + 10}px`,
          }}
        >
          <Text line size="xs" color="dimmed" on="surface">
            {hourMarkers()[showTooltip()!]}
          </Text>
          <HistogramTooltipValue>
            <Text label size="mono_xs" on="surface" color="dimmed">
              {props.units}
            </Text>
            <Text code size="mono_xs" on="surface">
              {barData()[showTooltip()!].value}
            </Text>
          </HistogramTooltipValue>
        </HistogramTooltip>
      </Show>
    </HistogramRoot>
  );
}
