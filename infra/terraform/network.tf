data "aws_availability_zones" "standard" {
  state = "available"

  filter {
    name   = "zone-type"
    values = ["availability-zone"]
  }
}

locals {
  # Fargate ARM64 is not supported in use1-az3.
  eligible_zone_ids = sort([
    for zone_id in data.aws_availability_zones.standard.zone_ids : zone_id if zone_id != "use1-az3"
  ])
  zones    = slice(local.eligible_zone_ids, 0, 2)
  api_port = 3000
}

resource "aws_vpc" "demo" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_internet_gateway" "demo" {
  vpc_id = aws_vpc.demo.id
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id               = aws_vpc.demo.id
  availability_zone_id = local.zones[count.index]
  cidr_block           = cidrsubnet(aws_vpc.demo.cidr_block, 8, count.index)
}

resource "aws_subnet" "private" {
  count = 2

  vpc_id               = aws_vpc.demo.id
  availability_zone_id = local.zones[count.index]
  cidr_block           = cidrsubnet(aws_vpc.demo.cidr_block, 8, count.index + 10)
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.demo.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.demo.id
  }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "api" {
  name        = "${var.project_name}-api"
  description = "Fargate health demo task"
  vpc_id      = aws_vpc.demo.id
}

resource "aws_security_group" "database" {
  name        = "${var.project_name}-database"
  description = "Private RDS PostgreSQL instance"
  vpc_id      = aws_vpc.demo.id
}

resource "aws_vpc_security_group_ingress_rule" "reviewer" {
  security_group_id = aws_security_group.api.id
  description       = "API health probe from one reviewer"
  cidr_ipv4         = var.reviewer_cidr
  ip_protocol       = "tcp"
  from_port         = local.api_port
  to_port           = local.api_port
}

resource "aws_vpc_security_group_egress_rule" "aws_https" {
  security_group_id = aws_security_group.api.id
  description       = "HTTPS for ECR image pulls and CloudWatch Logs"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "database_from_api" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "api_to_database" {
  security_group_id            = aws_security_group.api.id
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
