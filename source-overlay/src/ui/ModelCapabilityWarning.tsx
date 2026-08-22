import { Box, Text } from "ink";
import React from "react";

interface ModelCapabilityWarningProps {
  modelName: string;
}

const ModelCapabilityWarning: React.FC<ModelCapabilityWarningProps> = ({
  modelName,
}) => {
  return (
    <Box flexDirection="column" paddingX={0}>
      <Box flexDirection="row" alignItems="center">
        <Text bold color="white">
          {/* spaces in brackets to prevent prettier from fixing to 1 space */}
          ⚠️{"  "}模型能力提示
        </Text>
      </Box>
      <Text color="gray">
        模型“{modelName}”不建议用于 cn，因为推理和工具调用能力有限
      </Text>
    </Box>
  );
};

export { ModelCapabilityWarning };
