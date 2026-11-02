FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Give-AID.slnx ./
COPY backend/ ./backend/
RUN dotnet restore Give-AID.slnx
ARG SERVICE
RUN dotnet publish backend/${SERVICE}/${SERVICE}.csproj -c Release -o /app --no-restore --no-self-contained
FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG SERVICE
ENV SERVICE_NAME=${SERVICE}
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec dotnet ${SERVICE_NAME}.dll \"$@\"", "--"]
