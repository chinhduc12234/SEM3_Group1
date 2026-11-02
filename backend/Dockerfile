FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Give-AID.slnx ./
COPY backend/Directory.Build.props ./backend/
COPY backend/Shared/Shared.csproj ./backend/Shared/
COPY backend/IdentityService/IdentityService.csproj ./backend/IdentityService/
COPY backend/OrganizationService/OrganizationService.csproj ./backend/OrganizationService/
COPY backend/CampaignService/CampaignService.csproj ./backend/CampaignService/
COPY backend/DonationService/DonationService.csproj ./backend/DonationService/
COPY backend/VolunteerService/VolunteerService.csproj ./backend/VolunteerService/
COPY backend/ContentService/ContentService.csproj ./backend/ContentService/
# Preserve dependency restore across feature edits; adding source code does not invalidate this layer.
RUN dotnet restore Give-AID.slnx
COPY backend/ ./backend/
ARG SERVICE
RUN dotnet publish backend/${SERVICE}/${SERVICE}.csproj -c Release -o /app --no-restore --no-self-contained
FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG SERVICE
ENV SERVICE_NAME=${SERVICE}
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p /app/keys && chown $APP_UID /app/keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec dotnet ${SERVICE_NAME}.dll \"$@\"", "--"]
