/*
import { styled } from "@macaron-css/solid";
import { Link } from "@solidjs/router";

const Parent = styled(Link, {
  base: {
    color: "red",
  },
});

const Child = styled("div", {
  base: {
    selectors: {
      [`${Parent}:hover &`]: {
        color: "blue",
      },
    },
  },
});

export function Debug() {
  return (
    <Parent href="foo">
      <Child>Foo</Child>
    </Parent>
  );
}
*/

export function DebugRoute() {
  return <span />;
}
