import { useState, useEffect, useMemo } from 'react';
import { Text, Box } from 'ink';
import { markdownToAnsi } from '../utils/markdownToAnsi.js';

interface StreamingTextProps {
  text: string;
  markdown?: boolean;
  isStreaming: boolean;
}

export function StreamingText({ text, markdown = true, isStreaming }: StreamingTextProps) {
  const [tick, setTick] = useState(0);

  const { stablePrefix, unstableSuffix } = useMemo(() => {
    if (!isStreaming) {
      return { stablePrefix: text, unstableSuffix: '' };
    }

    const lastBlockBoundary = text.lastIndexOf('\n\n');
    if (lastBlockBoundary === -1) {
      return { stablePrefix: '', unstableSuffix: text };
    }

    return {
      stablePrefix: text.slice(0, lastBlockBoundary + 2),
      unstableSuffix: text.slice(lastBlockBoundary + 2),
    };
  }, [text, isStreaming]);

  const [ansiPrefix, setAnsiPrefix] = useState('');
  const [ansiSuffix, setAnsiSuffix] = useState('');

  useEffect(() => {
    let canceled = false;

    async function render() {
      const prefix = markdown ? await markdownToAnsi(stablePrefix) : stablePrefix;
      const suffix = markdown ? await markdownToAnsi(unstableSuffix) : unstableSuffix;

      if (!canceled) {
        setAnsiPrefix(prefix);
        setAnsiSuffix(suffix);
      }
    }

    render();

    return () => {
      canceled = true;
    };
  }, [stablePrefix, unstableSuffix, markdown, tick]);

  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => setTick(t => t + 1), 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  return (
    <Box flexDirection="column">
      <Text>{ansiPrefix}</Text>
      <Text>
        {ansiSuffix}
        {isStreaming && '▌'}
      </Text>
    </Box>
  );
}
