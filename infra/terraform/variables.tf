variable "aws_region" {
  description = "AWS region selected for the approved demo."
  type        = string
  nullable    = false
}

variable "project_name" {
  description = "Prefix for AWS resources in this demo."
  type        = string
  default     = "test-infrastructure-platform"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}[a-z0-9]$", var.project_name))
    error_message = "Use 4 to 32 lowercase letters, digits, and hyphens, starting with a letter and ending with a letter or digit."
  }
}

variable "reviewer_cidr" {
  description = "Single public IPv4 address allowed to probe the API over HTTP, expressed as an IPv4 /32."
  type        = string
  nullable    = false

  validation {
    condition     = can(cidrnetmask(var.reviewer_cidr)) && endswith(var.reviewer_cidr, "/32")
    error_message = "Set reviewer_cidr to a single IPv4 address with a /32 prefix length."
  }
}

variable "api_image_tag" {
  description = "Immutable ECR tag containing the Git SHA of the API image."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.api_image_tag))
    error_message = "Use a full, lowercase Git commit SHA as the ECR tag."
  }
}

variable "db_instance_class" {
  description = "Small RDS instance class for this single-AZ demonstration."
  type        = string
  default     = "db.t4g.micro"

  validation {
    condition     = contains(["db.t4g.micro", "db.t3.micro"], var.db_instance_class)
    error_message = "Choose db.t4g.micro or db.t3.micro."
  }
}

variable "task_cpu" {
  description = "Fargate CPU units for the one demo task."
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512], var.task_cpu)
    error_message = "Choose 256 or 512 Fargate CPU units."
  }
}

variable "task_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 512

  validation {
    condition = (
      (var.task_cpu == 256 && contains([512, 1024, 2048], var.task_memory)) ||
      (var.task_cpu == 512 && contains([1024, 2048, 3072, 4096], var.task_memory))
    )
    error_message = "Choose memory supported by the selected Fargate CPU size."
  }
}

variable "resolve_api_url" {
  description = "Look up the demo task's current public address. Disable for teardown if the task is already gone."
  type        = bool
  default     = true
}
