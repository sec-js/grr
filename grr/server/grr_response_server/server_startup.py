#!/usr/bin/env python
"""Server startup routines."""

import logging
import os
import platform

from absl import flags
import prometheus_client

from grr_response_core import config
from grr_response_core.config import contexts
from grr_response_core.lib import config_lib
from grr_response_core.lib import utils
# pylint: disable=unused-import
# TODO: Remove once old clients are fully deprecated.
from grr_response_core.lib.rdfvalues import deprecated as rdf_deprecated
# pylint: enable=unused-import
from grr_response_core.stats import stats_collector_instance
from grr_response_server import artifact
from grr_response_server import cronjobs
from grr_response_server import data_store
from grr_response_server import email_alerts
from grr_response_server import ip_resolver
from grr_response_server import prometheus_stats_collector
from grr_response_server import server_logging
from grr_response_server import server_plugins  # pylint: disable=unused-import
from grr_response_server import stats_server
from grr_response_server.authorization import client_approval_auth
from grr_response_server.blob_stores import registry_init as bs_registry_init
from grr_response_server.export_converters import registry_init as ec_registry_init
from grr_response_server.gui import api_auth_manager
from grr_response_server.gui import gui_plugins  # pylint: disable=unused-import
from grr_response_server.gui import http_api
from grr_response_server.gui import registry_init as gui_api_registry_init
from grr_response_server.gui import webauth

# pylint: disable=g-import-not-at-top

if platform.system() != "Windows":
  import pwd
# pylint: enable=g-import-not-at-top


def DropPrivileges():
  """Attempt to drop privileges if required."""
  if config.CONFIG["Server.username"]:
    try:
      os.setuid(pwd.getpwnam(config.CONFIG["Server.username"]).pw_uid)
    except (KeyError, OSError):
      logging.exception(
          "Unable to switch to user %s", config.CONFIG["Server.username"]
      )
      raise


# TODO: Temporarily added option to prevent worker from picking up
# work.
@utils.RunOnce  # Make sure we do not reinitialize multiple times.
def Init(disabled: bool = False):
  """Run all required startup routines and initialization hooks."""
  # Set up a temporary syslog handler so we have somewhere to log problems
  # with ConfigInit() which needs to happen before we can start our create our
  # proper logging setup.
  syslog_logger = logging.getLogger("TempLogger")
  if os.path.exists("/dev/log"):
    handler = logging.handlers.SysLogHandler(address="/dev/log")
  else:
    handler = logging.handlers.SysLogHandler()
  syslog_logger.addHandler(handler)

  # The default behavior of server components is to raise errors when
  # encountering unknown config options.
  flags.FLAGS.disallow_missing_config_definitions = True

  try:
    config_lib.SetPlatformArchContext()
    config_lib.ParseConfigCommandLine(rename_invalid_writeback=False)
  except config_lib.Error:
    syslog_logger.exception("Died during config initialization")
    raise

  stats_collector = prometheus_stats_collector.PrometheusStatsCollector(
      registry=prometheus_client.REGISTRY
  )
  stats_collector_instance.Set(stats_collector)

  server_logging.ServerLoggingStartupInit()

  bs_registry_init.RegisterBlobStores()
  ec_registry_init.RegisterExportConverters()
  gui_api_registry_init.RegisterApiCallRouters()

  data_store.InitializeDataStore()

  if contexts.ADMIN_UI_CONTEXT in config.CONFIG.context:
    api_auth_manager.InitializeApiAuthManager()

  artifact.LoadArtifactsOnce()  # Requires aff4.AFF4Init.
  client_approval_auth.InitializeClientApprovalAuthorizationManagerOnce()
  if not disabled:
    cronjobs.InitializeCronWorkerOnce()
  email_alerts.InitializeEmailAlerterOnce()
  http_api.InitializeHttpRequestHandlerOnce()
  ip_resolver.IPResolverInitOnce()
  stats_server.InitializeStatsServerOnce()
  webauth.InitializeWebAuthOnce()

  # Exempt config updater from this check because it is the one responsible for
  # setting the variable.
  if not config.CONFIG.ContextApplied("ConfigUpdater Context"):
    if not config.CONFIG.Get("Server.initialized"):
      raise RuntimeError(
          'Config not initialized, run "grr_config_updater'
          ' initialize". If the server is already configured,'
          ' add "Server.initialized: True" to your config.'
      )
