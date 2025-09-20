#!/usr/bin/env bash

curl 'https://dex-backend-prod1.defi.gala.com/explore/pools?limit=20&page=1&sortBy=volume1d&sortOrder=desc' | jq