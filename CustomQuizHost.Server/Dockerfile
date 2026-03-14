# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0.2 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0.102 AS with-node
RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash
RUN apt-get -y install nodejs


FROM with-node AS build
ARG BUILD_CONFIGURATION=Release
ARG VERSION=dev
ENV VITE_APP_VERSION=$VERSION
WORKDIR /src
COPY ["CustomQuizHost.Server/CustomQuizHost.Server.csproj", "CustomQuizHost.Server/"]
COPY ["customquizhost.client/customquizhost.client.esproj", "customquizhost.client/"]
RUN dotnet restore "./CustomQuizHost.Server/CustomQuizHost.Server.csproj"
COPY . .
WORKDIR "/src/CustomQuizHost.Server"
RUN dotnet build "./CustomQuizHost.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./CustomQuizHost.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
RUN mkdir -p /app/uploads
ENTRYPOINT ["dotnet", "CustomQuizHost.Server.dll"]
