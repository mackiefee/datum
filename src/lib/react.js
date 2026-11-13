import React, { useState, useMemo, useEffect, useRef, Fragment, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';

const html = htm.bind(createElement);

export {
  React,
  useState,
  useMemo,
  useEffect,
  useRef,
  Fragment,
  createElement,
  createRoot,
  html,
};
