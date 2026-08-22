import { Box, Text } from "ink";
import React from "react";

import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";

import { defaultBoxStyles } from "./styles.js";

interface ServiceDebuggerProps {
  services: {
    auth?: AuthServiceState;
    config?: ConfigServiceState;
    model?: ModelServiceState;
    mcp?: MCPServiceState;
    apiClient?: ApiClientServiceState;
  };
  loading: boolean;
  error: any;
  allReady: boolean;
  servicesLoading: boolean;
  servicesError: any;
}

const ServiceDebugger: React.FC<ServiceDebuggerProps> = ({
  services,
  loading,
  error,
  allReady,
  servicesLoading,
  servicesError,
}) => {
  const getServiceStatus = (serviceName: string, service: any) => {
    if (!service) return "❌ 未加载";
    if (service.error) return `❌ 错误：${service.error}`;
    return "✅ 就绪";
  };

  const getServiceDetails = (serviceName: string, service: any) => {
    switch (serviceName) {
      case "auth":
        return service?.authConfig
          ? `用户：${service.authConfig.email || "未知"}`
          : "没有认证配置";
      case "config":
        return service?.config ? `配置：${service.config.name}` : "没有配置";
      case "model":
        return service?.model ? `模型：${service.model.name}` : "没有模型";
      case "mcp":
        return service?.mcpService
          ? `工具：${service.mcpService.getTools()?.length || 0}`
          : "没有 MCP 服务";
      case "apiClient":
        return service?.apiClient ? "API 客户端就绪" : "没有 API 客户端";
      default:
        return "";
    }
  };

  return (
    <Box {...defaultBoxStyles("cyan")}>
      <Text bold color="cyan">
        🔧 服务调试信息
      </Text>
      <Text> </Text>

      <Text color="yellow">总体状态：</Text>
      <Text>加载中：{loading ? "🟡 是" : "✅ 否"}</Text>
      <Text>全部就绪：{allReady ? "✅ 是" : "❌ 否"}</Text>
      <Text>服务加载中：{servicesLoading ? "🟡 是" : "✅ 否"}</Text>

      {error && <Text color="red">错误：{String(error)}</Text>}

      {servicesError && (
        <Text color="red">服务错误：{String(servicesError)}</Text>
      )}

      <Text> </Text>
      <Text color="yellow">各项服务：</Text>

      {["auth", "config", "model", "mcp", "apiClient"].map((serviceName) => {
        const service = services[serviceName as keyof typeof services];
        const status = getServiceStatus(serviceName, service);
        const details = getServiceDetails(serviceName, service);

        return (
          <Box key={serviceName} flexDirection="column" marginLeft={2}>
            <Text>
              <Text color="white">{serviceName}:</Text> {status}
            </Text>
            {details && (
              <Box marginLeft={2}>
                <Text color="gray">{details}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      <Text> </Text>
      <Text color="yellow">启动信息条件：</Text>
      <Text>服务就绪：{allReady ? "✅" : "❌"}</Text>
      <Text>有配置：{services.config?.config ? "✅" : "❌"}</Text>
      <Text>有模型：{services.model?.model ? "✅" : "❌"}</Text>
      <Text>有 MCP 服务：{services.mcp?.mcpService ? "✅" : "❌"}</Text>

      <Text> </Text>
      <Text color="gray" italic>
        调试完成后可以移除这个组件
      </Text>
    </Box>
  );
};

export { ServiceDebugger };
