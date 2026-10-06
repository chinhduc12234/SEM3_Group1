FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG SERVICE
WORKDIR /src
COPY backend/ ./backend/
RUN dotnet publish backend/${SERVICE}/${SERVICE}.csproj -c Release -o /app --no-self-contained
FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG SERVICE
ENV SERVICE_NAME=${SERVICE}
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec dotnet ${SERVICE_NAME}.dll \"$@\"", "--"]
