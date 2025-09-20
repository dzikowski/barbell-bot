#!/usr/bin/env bash

tokenIn="GALA\$Unit\$none\$none"
tokenOut="GUSDC\$Unit\$none\$none"
amountIn=10000
amountOut=1
fee=10000

url="https://dex-backend-prod1.defi.gala.com/v1/trade/quote"
query="?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&fee=${fee}"

curl -X GET "${url}${query}"
