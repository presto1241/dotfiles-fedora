#!/bin/bash
DATA=$(sensors -j 2>/dev/null)
cpu=$(echo "$DATA" | jq -r '.["k10temp-pci-00c3"].Tctl.temp1_input // 0 | round')
gpu=$(echo "$DATA" | jq -r '.["amdgpu-pci-2d00"].edge.temp1_input // 0 | round')
echo "CPU ${cpu}°C  GPU ${gpu}°C"
