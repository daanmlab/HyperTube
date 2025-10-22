#!/bin/bash

# Check aria2 download status with seeders info
echo "=== Aria2 Active Downloads ==="
curl -s -X POST http://localhost:6800/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"aria2.tellActive","params":["token:superlongrandomtoken"]}' \
  | jq '.result[] | {
      gid, 
      status, 
      name: (.bittorrent.info.name // "Unknown"),
      totalLength: (.totalLength | tonumber / 1024 / 1024 / 1024 | tostring + " GB"),
      completedLength: (.completedLength | tonumber / 1024 / 1024 / 1024 | tostring + " GB"),
      downloadSpeed: (.downloadSpeed | tonumber / 1024 / 1024 | tostring + " MB/s"),
      uploadSpeed: (.uploadSpeed | tonumber / 1024 / 1024 | tostring + " MB/s"),
      numSeeders,
      connections,
      progress: (if (.totalLength | tonumber) > 0 then ((.completedLength | tonumber) / (.totalLength | tonumber) * 100 | tostring + "%") else "0%" end)
    }'

echo ""
echo "=== Movie Database Status ==="
curl -s 'http://localhost:3000/movies/library' | jq '.[] | {
  title,
  status,
  downloadProgress: (.downloadProgress + "%"),
  transcodeProgress: (.transcodeProgress + "%"),
  downloadedSize: ((.downloadedSize | tonumber) / 1024 / 1024 / 1024 | tostring + " GB"),
  totalSize: ((.totalSize | tonumber) / 1024 / 1024 / 1024 | tostring + " GB")
}'
