# STARTER TEMPLATE, not validated (Terraform was not available when written).
# Note: for a purely static site, S3 + CloudFront is cheaper and simpler than running a container.
# Creates: ECS cluster, Fargate service, ALB (HTTP only: add an ACM cert + HTTPS listener for real use),
# log group. Does NOT create the VPC, subnets, or ECR repo.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "region"             { default = "us-east-2" }
variable "name"               { default = "health-pulse" }
variable "image_uri"          { description = "e.g. 123456789012.dkr.ecr.us-east-2.amazonaws.com/health-pulse:1" }
variable "vpc_id"             {}
variable "public_subnet_ids"  { type = list(string) } # ALB
variable "private_subnet_ids" { type = list(string) } # tasks (need NAT or ECR VPC endpoints to pull the image)
variable "desired_count"      { default = 1 }

provider "aws" { region = var.region }

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "this" { name = var.name }

resource "aws_iam_role" "exec" {
  name = "${var.name}-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

# Lets Fargate pull from ECR and write logs.
resource "aws_iam_role_policy_attachment" "exec" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_security_group" "alb" {
  name   = "${var.name}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Tasks accept traffic only from the ALB.
resource "aws_security_group" "task" {
  name   = "${var.name}-task"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "this" {
  name        = var.name
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # required for Fargate awsvpc networking
  health_check { path = "/healthz" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.exec.arn
  container_definitions = jsonencode([{
    name                   = "web"
    image                  = var.image_uri
    essential              = true
    user                   = "101" # non-root; matches the image
    readonlyRootFilesystem = false # nginx needs /tmp; Fargate has no tmpfs, so keep rootfs writable
    portMappings           = [{ containerPort = 8080, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "web"
      }
    }
  }])
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.task.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = "web"
    container_port   = 8080
  }
  depends_on = [aws_lb_listener.http]
}

output "url" { value = "http://${aws_lb.this.dns_name}" }
