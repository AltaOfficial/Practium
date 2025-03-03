"use client";

import { MathJaxContext } from "better-react-mathjax";

import React from "react";

export default function MathjaxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MathJaxContext>{children}</MathJaxContext>;
}
